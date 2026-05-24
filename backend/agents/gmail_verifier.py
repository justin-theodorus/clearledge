"""Gmail-based verifier for BANK_TRANSFER invoices.

For invoices paid by direct bank transfer there is no Stripe webhook to
anchor a ledger row. This agent reads the SME's Gmail for the DBS
"You've received a transfer" notification, cross-checks the credited
account / keyword / amount / currency against the invoice, and writes a
synthetic ``transactions`` row when the account-last4 gate passes.

Cross-checks (each scored 0/1):
- account_match: last 4 digits of credited account == SME_ACCOUNT_NUMBER[-4:]
- keyword_match: body contains a credit keyword ("received")
- amount_match: within ±2% of the invoice amount, converting via Frankfurter
  when currencies differ
- currency_match: ISO match against invoice currency (recorded, not gating)

If ``account_match`` is False the agent records ACCOUNT_MISMATCH and
does NOT create a transaction.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Literal, Optional

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel

_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

from backend.services.chutes_client import get_chutes_client
from backend.services.google_oauth import GmailNotConnectedError, get_gmail_client
from backend.services.supabase_service import (
    get_invoice,
    insert_gmail_verification,
    insert_transaction,
    update_invoice_status,
)

log = logging.getLogger(__name__)

AGENT_VERSION = "gmail_verifier@v1"
FRANKFURTER_BASE = "https://api.frankfurter.app"
# Amount scoring bands. Within ±2% → full 1.0; linear decay to 0.5 at ±5%;
# 0.0 beyond. Mirrors the STRIPE matcher so both paths fail gracefully.
AMOUNT_TOLERANCE = Decimal("0.02")
AMOUNT_HARD_CAP = Decimal("0.05")
GMAIL_QUERY_LIMIT = 10
DBS_SENDER = "ibanking.alert@dbs.com"
# Lookback window for Gmail search. Wide enough that demos using older test
# emails still work; narrow enough to keep Chutes extraction bounded.
GMAIL_LOOKBACK_DAYS = 7

EXTRACTOR_SYSTEM = (
    "You parse DBS digibank transfer notification emails (received transfers, "
    "outgoing transfers, and own-account transfers). "
    "Return ONLY a single JSON object with keys: "
    "amount (number), currency (3-letter ISO 4217), sender (string), "
    "transferred_at (ISO 8601 datetime including timezone offset, e.g. "
    "'2026-05-05T20:10:00+08:00'), rail (string like PayNow/FAST/GIRO or null), "
    "credited_account_last4 (4-digit string of the TO/credited account), "
    "transaction_ref (string), received_keyword_present (boolean true if the "
    "body indicates either an incoming credit ('received', 'credited', "
    "'transferred to your account') OR a successfully executed transfer that "
    "lands in the credited account ('completed', 'successful', 'has been "
    "completed'). Set false only for failed/pending/cancelled transfers or "
    "outgoing-only debit alerts. "
    "IMPORTANT: When a date in the body is missing a year (e.g. '24 May'), "
    "assume the current year provided in the user message. Never guess a "
    "year more than 90 days from today. Use null when a field is missing. "
    "No prose, no code fences."
)

Status = Literal[
    "FOUND",
    "NOT_FOUND",
    "ACCOUNT_MISMATCH",
    "ERROR",
    "SKIPPED_NOT_BANK_TRANSFER",
]


class GmailExtract(BaseModel):
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    sender: Optional[str] = None
    transferred_at: Optional[datetime] = None
    rail: Optional[str] = None
    credited_account_last4: Optional[str] = None
    transaction_ref: Optional[str] = None
    received_keyword_present: Optional[bool] = None


class GmailChecks(BaseModel):
    account_match: bool
    keyword_match: bool
    # amount_match is a graded 0..1 score (full credit within ±2%, linear
    # decay to 0.5 at ±5%, 0.0 beyond). Kept as a number so the matcher can
    # weight it directly without losing the partial-credit signal.
    amount_match: Decimal
    currency_match: bool


class VerifierResult(BaseModel):
    invoice_id: str
    status: Status
    message_id: Optional[str] = None
    checks: Optional[GmailChecks] = None
    extracted: Optional[GmailExtract] = None
    created_transaction_id: Optional[str] = None
    reason: Optional[str] = None


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def _extract_json(text: str) -> Optional[dict]:
    if not text:
        return None
    candidate = text.strip()
    fence = _JSON_FENCE_RE.search(candidate)
    if fence:
        candidate = fence.group(1).strip()
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start != -1 and end > start:
            try:
                return json.loads(candidate[start : end + 1])
            except json.JSONDecodeError:
                return None
    return None


def _decode_body(payload: dict) -> str:
    """Walks a Gmail message payload tree and concatenates text/plain + text/html bodies."""
    parts: list[str] = []

    def walk(node: dict) -> None:
        body = node.get("body") or {}
        data = body.get("data")
        if data:
            try:
                decoded = base64.urlsafe_b64decode(data.encode("ascii")).decode(
                    "utf-8", errors="replace"
                )
                parts.append(decoded)
            except Exception:
                pass
        for sub in node.get("parts") or []:
            walk(sub)

    walk(payload)
    return "\n".join(parts)


def _strip_html(html: str) -> str:
    text = re.sub(r"<style.*?</style>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<script.*?</script>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _gmail_search_query(invoice_created_at: datetime) -> str:
    # No subject filter: DBS uses several templates ("received a transfer",
    # "Funds Transfer to own account", "Outgoing transfer", etc.). We let the
    # account-last4 gate + Chutes extraction sort out which ones matter.
    earliest = invoice_created_at - timedelta(days=GMAIL_LOOKBACK_DAYS)
    window_start = earliest.strftime("%Y/%m/%d")
    window_end = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y/%m/%d")
    return f"from:{DBS_SENDER} after:{window_start} before:{window_end}"


def _parse_invoice_created_at(value) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return datetime.now(timezone.utc)


def _to_decimal(value) -> Optional[Decimal]:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value).replace(",", ""))
    except (InvalidOperation, ValueError):
        return None


def _fetch_fx_rate(rate_date, from_ccy: str, to_ccy: str) -> Optional[Decimal]:
    try:
        resp = httpx.get(
            f"{FRANKFURTER_BASE}/{rate_date.isoformat()}",
            params={"from": from_ccy, "to": to_ccy},
            timeout=15,
            follow_redirects=True,
        )
        if resp.status_code != 200:
            return None
        rates = (resp.json() or {}).get("rates") or {}
        return Decimal(str(rates[to_ccy])) if to_ccy in rates else None
    except Exception:
        log.exception("Frankfurter lookup failed")
        return None


def _amount_match(
    invoice_amount: Optional[Decimal],
    invoice_currency: Optional[str],
    email_amount: Optional[Decimal],
    email_currency: Optional[str],
    transferred_at: Optional[datetime],
) -> Decimal:
    """Returns a graded 0..1 score for how closely the email amount matches
    the invoice amount after FX conversion. 1.0 at ≤2% diff, linear decay to
    0.5 at 5%, 0.0 beyond. Mirrors the STRIPE matcher's amount_score logic.
    """
    if invoice_amount is None or email_amount is None:
        return Decimal("0")
    inv_ccy = (invoice_currency or "").upper()
    em_ccy = (email_currency or "").upper()
    if not inv_ccy or not em_ccy:
        return Decimal("0")

    if inv_ccy == em_ccy:
        compared = email_amount
    else:
        when = (transferred_at or datetime.now(timezone.utc)).date()
        rate = _fetch_fx_rate(when, em_ccy, inv_ccy)
        if rate is None:
            return Decimal("0")
        compared = email_amount * rate

    if invoice_amount == 0:
        return Decimal("0")
    diff = abs(compared - invoice_amount) / invoice_amount
    if diff <= AMOUNT_TOLERANCE:
        return Decimal("1.0")
    if diff >= AMOUNT_HARD_CAP:
        return Decimal("0.0")
    # Linear decay 1.0 @ 2% → 0.5 @ 5%.
    ratio = (diff - AMOUNT_TOLERANCE) / (AMOUNT_HARD_CAP - AMOUNT_TOLERANCE)
    return (Decimal("1.0") - ratio * Decimal("0.5")).quantize(Decimal("0.001"))


def _extract_with_chutes(email_text: str, today: datetime) -> GmailExtract:
    client = get_chutes_client()
    model = os.environ["CHUTES_GEMMA_MODEL"]
    log.info("[gmail_verifier] calling Chutes model=%s body_chars=%d", model, len(email_text))
    user_message = (
        f"Today is {today.strftime('%Y-%m-%d')} (UTC). "
        f"Current year is {today.year}. "
        f"Parse the DBS email below.\n\n{email_text[:8000]}"
    )
    completion = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": EXTRACTOR_SYSTEM},
            {"role": "user", "content": user_message},
        ],
    )
    raw = completion.choices[0].message.content or ""
    log.info("[gmail_verifier] Chutes raw response: %s", raw[:500])
    parsed = _extract_json(raw) or {}
    if isinstance(parsed.get("credited_account_last4"), int):
        parsed["credited_account_last4"] = str(parsed["credited_account_last4"])
    try:
        extracted = GmailExtract(**parsed)
        # Safety net: if Chutes still hallucinated a year wildly off, clamp
        # to the current year. This protects FX lookups and date scoring.
        if extracted.transferred_at is not None:
            delta_days = abs((extracted.transferred_at.date() - today.date()).days)
            if delta_days > 90:
                clamped = extracted.transferred_at.replace(year=today.year)
                log.warning(
                    "[gmail_verifier] transferred_at %s is %d days from today — clamping to %s",
                    extracted.transferred_at.isoformat(), delta_days, clamped.isoformat(),
                )
                extracted = extracted.model_copy(update={"transferred_at": clamped})
        log.info(
            "[gmail_verifier] extracted: amount=%s currency=%s last4=%s rail=%s received=%s transferred_at=%s",
            extracted.amount, extracted.currency, extracted.credited_account_last4,
            extracted.rail, extracted.received_keyword_present,
            extracted.transferred_at.isoformat() if extracted.transferred_at else None,
        )
        return extracted
    except Exception:
        log.exception("[gmail_verifier] GmailExtract validation failed; raw parsed=%r", parsed)
        return GmailExtract()


def _persist(
    invoice_id: str,
    status: Status,
    message_id: Optional[str],
    checks: Optional[GmailChecks],
    created_transaction_id: Optional[str],
    reason: Optional[str],
) -> None:
    insert_gmail_verification(
        {
            "invoice_id": invoice_id,
            "gmail_message_id": message_id,
            # mode="json" coerces Decimal to a JSON-safe number for Supabase.
            "checks": checks.model_dump(mode="json") if checks else {},
            "status": status,
            "created_transaction_id": created_transaction_id,
            "reason": reason,
        }
    )


def verify(invoice_id: str) -> VerifierResult:
    log.info("[gmail_verifier] === start invoice=%s ===", invoice_id)
    invoice = get_invoice(invoice_id)
    log.info(
        "[gmail_verifier] invoice: no=%s payment_method=%s amount=%s currency=%s created_at=%s",
        invoice.get("invoice_no"), invoice.get("payment_method"),
        invoice.get("amount"), invoice.get("currency"), invoice.get("created_at"),
    )
    if invoice.get("payment_method") != "BANK_TRANSFER":
        log.info("[gmail_verifier] skipping — not a BANK_TRANSFER invoice")
        _persist(invoice_id, "SKIPPED_NOT_BANK_TRANSFER", None, None, None,
                 "Invoice is not BANK_TRANSFER")
        return VerifierResult(invoice_id=invoice_id, status="SKIPPED_NOT_BANK_TRANSFER")

    sme_account = os.environ.get("SME_ACCOUNT_NUMBER", "")
    sme_last4 = sme_account[-4:] if sme_account else ""
    log.info("[gmail_verifier] SME account last4=%r", sme_last4)
    if not sme_last4:
        log.warning("[gmail_verifier] SME_ACCOUNT_NUMBER env var is empty — account_match will always fail")

    try:
        gmail = get_gmail_client()
        log.info("[gmail_verifier] Gmail client built")
    except GmailNotConnectedError as e:
        log.error("[gmail_verifier] %s", e)
        _persist(invoice_id, "ERROR", None, None, None, str(e))
        return VerifierResult(invoice_id=invoice_id, status="ERROR", reason=str(e))

    query = _gmail_search_query(_parse_invoice_created_at(invoice.get("created_at")))
    log.info("[gmail_verifier] Gmail query: %s", query)

    try:
        listing = (
            gmail.users()
            .messages()
            .list(userId="me", q=query, maxResults=GMAIL_QUERY_LIMIT)
            .execute()
        )
    except Exception as e:
        log.exception("[gmail_verifier] messages.list failed")
        _persist(invoice_id, "ERROR", None, None, None, f"messages.list failed: {e}")
        return VerifierResult(invoice_id=invoice_id, status="ERROR", reason=str(e))

    message_refs = listing.get("messages") or []
    log.info("[gmail_verifier] Gmail returned %d candidate message(s)", len(message_refs))
    if not message_refs:
        _persist(invoice_id, "NOT_FOUND", None, None, None,
                 "No DBS 'received a transfer' email matched the search window")
        return VerifierResult(invoice_id=invoice_id, status="NOT_FOUND")

    invoice_amount = _to_decimal(invoice.get("amount"))
    invoice_currency = (invoice.get("currency") or "").upper() or None

    last_extract: Optional[GmailExtract] = None
    last_checks: Optional[GmailChecks] = None
    last_message_id: Optional[str] = None
    account_mismatch_seen = False

    for idx, ref in enumerate(message_refs, start=1):
        msg_id = ref.get("id")
        if not msg_id:
            continue
        log.info("[gmail_verifier] === message %d/%d id=%s ===", idx, len(message_refs), msg_id)
        try:
            msg = (
                gmail.users()
                .messages()
                .get(userId="me", id=msg_id, format="full")
                .execute()
            )
        except Exception as e:
            log.exception("[gmail_verifier] messages.get failed for %s", msg_id)
            _persist(invoice_id, "ERROR", msg_id, None, None, f"messages.get failed: {e}")
            return VerifierResult(invoice_id=invoice_id, status="ERROR", reason=str(e))

        body_raw = _decode_body(msg.get("payload") or {})
        body_text = _strip_html(body_raw) if "<" in body_raw else body_raw
        log.info("[gmail_verifier] body chars=%d (stripped)", len(body_text))
        extracted = _extract_with_chutes(body_text, datetime.now(timezone.utc))
        last_extract = extracted
        last_message_id = msg_id

        account_match = bool(
            sme_last4
            and extracted.credited_account_last4
            and extracted.credited_account_last4[-4:] == sme_last4
        )
        keyword_match = bool(extracted.received_keyword_present)
        amt_score = _amount_match(
            invoice_amount,
            invoice_currency,
            extracted.amount,
            extracted.currency,
            extracted.transferred_at,
        )
        # currency_match: same ISO is the trivial case. For cross-border,
        # if the amount reconciled via FX (any partial credit) the currencies
        # are compatible — penalising the mismatch would double-count the FX
        # conversion. Only False when neither currency nor amount agree at all.
        same_ccy = bool(
            invoice_currency
            and extracted.currency
            and extracted.currency.upper() == invoice_currency
        )
        currency_match = same_ccy or amt_score > 0
        checks = GmailChecks(
            account_match=account_match,
            keyword_match=keyword_match,
            amount_match=amt_score,
            currency_match=currency_match,
        )
        last_checks = checks
        log.info(
            "[gmail_verifier] checks: account=%s keyword=%s amount=%s currency=%s",
            account_match, keyword_match, amt_score, currency_match,
        )

        if not account_match:
            log.info(
                "[gmail_verifier] account mismatch — email last4=%r vs SME last4=%r — continuing",
                extracted.credited_account_last4, sme_last4,
            )
            account_mismatch_seen = True
            continue

        # Account matches — synthesise the transaction and stop.
        if extracted.amount is None or not extracted.currency:
            _persist(invoice_id, "ERROR", msg_id, checks, None,
                     "Email matched account but amount/currency could not be extracted")
            return VerifierResult(
                invoice_id=invoice_id,
                status="ERROR",
                message_id=msg_id,
                checks=checks,
                extracted=extracted,
                reason="amount or currency missing from extraction",
            )

        paid_at = (extracted.transferred_at or datetime.now(timezone.utc)).astimezone(
            timezone.utc
        )
        tx_row = insert_transaction(
            {
                "invoice_id": invoice_id,
                "amount_received": str(extracted.amount),
                "currency_received": extracted.currency.upper(),
                "paid_at": paid_at.isoformat(),
                "stripe_payment_intent": f"gmail:{msg_id}",
            }
        )
        tx_id = tx_row.get("id") if tx_row else None

        update_invoice_status(invoice_id, "PAID")
        log.info(
            "[gmail_verifier] FOUND — synthesised transaction %s, invoice flipped to PAID",
            tx_id,
        )
        _persist(invoice_id, "FOUND", msg_id, checks, tx_id,
                 "DBS notification matched and transaction synthesised")
        return VerifierResult(
            invoice_id=invoice_id,
            status="FOUND",
            message_id=msg_id,
            checks=checks,
            extracted=extracted,
            created_transaction_id=tx_id,
        )

    # Loop finished without an account match
    if account_mismatch_seen:
        _persist(
            invoice_id,
            "ACCOUNT_MISMATCH",
            last_message_id,
            last_checks,
            None,
            "DBS email(s) found but credited account did not match SME_ACCOUNT_NUMBER last 4",
        )
        return VerifierResult(
            invoice_id=invoice_id,
            status="ACCOUNT_MISMATCH",
            message_id=last_message_id,
            checks=last_checks,
            extracted=last_extract,
            reason="account last4 mismatch",
        )

    _persist(invoice_id, "NOT_FOUND", None, None, None, "No usable DBS emails found")
    return VerifierResult(invoice_id=invoice_id, status="NOT_FOUND")


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) != 2:
        print("usage: python -m backend.agents.gmail_verifier <invoice_id>", file=sys.stderr)
        sys.exit(2)
    result = verify(sys.argv[1])
    print(json.dumps(result.model_dump(mode="json"), indent=2, default=str))
