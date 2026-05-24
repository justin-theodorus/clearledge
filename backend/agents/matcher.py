import json
import logging
from datetime import date as date_type
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv
from pydantic import BaseModel
from rapidfuzz import fuzz

_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

from backend.agents.fx_resolver import FxResult, resolve
from backend.services.supabase_service import (
    get_invoice,
    get_latest_gmail_verification,
    get_latest_proof_extracted,
    update_invoice_status,
    update_proof_match,
)

log = logging.getLogger(__name__)

Status = Literal["RECONCILED", "PARTIAL", "UNVERIFIED"]

NO_PROOF_CAP = Decimal("0.85")

WEIGHTS = {
    "amount": Decimal("0.50"),
    "date": Decimal("0.20"),
    "sender": Decimal("0.20"),
    "reference": Decimal("0.10"),
}

# BANK_TRANSFER-specific weights. Gmail signal dominates because the bank
# notification is the closest thing to a webhook for this rail; proof is a
# secondary corroboration; date proximity is a tie-breaker.
BANK_WEIGHTS = {
    "gmail": Decimal("0.50"),
    "proof": Decimal("0.30"),
    "date_proximity": Decimal("0.20"),
}

# Sub-weights inside the composite Gmail signal (see GmailChecks in gmail_verifier).
GMAIL_SUB_WEIGHTS = {
    "account_match": Decimal("0.4"),
    "amount_match": Decimal("0.3"),
    "keyword_match": Decimal("0.2"),
    "currency_match": Decimal("0.1"),
}

# Caps for the BANK_TRANSFER path when key signals are missing.
BANK_NO_GMAIL_CAP = Decimal("0.5")
BANK_NO_PROOF_CAP = Decimal("0.7")


class MatchSignals(BaseModel):
    amount_score: Optional[Decimal] = None
    date_score: Optional[Decimal] = None
    sender_score: Optional[Decimal] = None
    reference_score: Optional[Decimal] = None
    amount_diff_ratio: Optional[Decimal] = None
    date_diff_days: Optional[int] = None


class MatchResult(BaseModel):
    invoice_id: str
    status: Status
    confidence: Decimal
    proof_present: bool
    capped: bool
    signals: MatchSignals
    fx: FxResult
    reasons: list[str]


def _amount_score(fx: FxResult) -> tuple[Optional[Decimal], Optional[Decimal]]:
    """Return (score, worst_diff_pct). Worst of the two legs when both are present."""
    txn = fx.txn_amount
    if txn == 0:
        return None, None

    diffs: list[Decimal] = []
    inv_amt = fx.invoice_to_txn.amount_converted
    if inv_amt is not None:
        diffs.append(abs(inv_amt - txn) / txn)
    if fx.proof_to_txn and fx.proof_to_txn.amount_converted is not None:
        diffs.append(abs(fx.proof_to_txn.amount_converted - txn) / txn)

    if not diffs:
        return None, None

    worst = max(diffs)
    if worst <= Decimal("0.02"):
        score = Decimal("1.0")
    elif worst >= Decimal("0.05"):
        score = Decimal("0.0")
    else:
        # linear decay from 1.0 @ 0.02 → 0.5 @ 0.05
        ratio = (worst - Decimal("0.02")) / Decimal("0.03")
        score = Decimal("1.0") - ratio * Decimal("0.5")
    return score, worst


def _date_score(proof_date: Optional[date_type], paid_at: datetime) -> tuple[Optional[Decimal], Optional[int]]:
    if proof_date is None:
        return None, None
    diff = abs((proof_date - paid_at.date()).days)
    table = {0: "1.0", 1: "0.9", 2: "0.75", 3: "0.6"}
    if diff in table:
        return Decimal(table[diff]), diff
    return Decimal("0.0"), diff


def _sender_score(proof_sender: Optional[str], client_name: Optional[str]) -> Optional[Decimal]:
    if not proof_sender or not client_name:
        return None
    ratio = fuzz.token_set_ratio(proof_sender, client_name) / 100
    return Decimal(str(ratio)).quantize(Decimal("0.001"))


def _reference_score(proof_ref: Optional[str], invoice_no: Optional[str]) -> Optional[Decimal]:
    if not proof_ref or not invoice_no:
        return None
    if invoice_no.lower() in proof_ref.lower():
        return Decimal("1.0")
    ratio = fuzz.partial_ratio(proof_ref, invoice_no) / 100
    return Decimal(str(ratio)).quantize(Decimal("0.001"))


def _parse_proof_date(value) -> Optional[date_type]:
    if value is None or value == "":
        return None
    if isinstance(value, date_type) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return date_type.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _combine(signals: MatchSignals) -> Decimal:
    pairs: list[tuple[Decimal, Decimal]] = []
    for key, score in (
        ("amount", signals.amount_score),
        ("date", signals.date_score),
        ("sender", signals.sender_score),
        ("reference", signals.reference_score),
    ):
        if score is not None:
            pairs.append((WEIGHTS[key], score))

    if not pairs:
        return Decimal("0.0")

    total_weight = sum((w for w, _ in pairs), start=Decimal("0"))
    weighted = sum((w * s for w, s in pairs), start=Decimal("0"))
    return weighted / total_weight


def _threshold(confidence: Decimal) -> Status:
    if confidence > Decimal("0.85"):
        return "RECONCILED"
    if confidence >= Decimal("0.5"):
        return "PARTIAL"
    return "UNVERIFIED"


def _proof_signals_available(fx: FxResult) -> bool:
    if not fx.proof_present:
        return False
    if fx.proof_to_txn is None:
        return False
    return fx.proof_to_txn.status in ("RESOLVED", "SAME_CURRENCY")


def _gmail_signal_score(checks: Optional[dict]) -> Optional[Decimal]:
    """Composite of the four Gmail checks, weighted by GMAIL_SUB_WEIGHTS.

    `amount_match` is a graded 0..1 score (linear decay 2%→5%), the other
    three are booleans treated as 0 or 1. Pre-existing rows that stored
    `amount_match` as a bool still work — bool(True) → 1, bool(False) → 0.
    """
    if not checks:
        return None
    total = Decimal("0")
    for key, weight in GMAIL_SUB_WEIGHTS.items():
        raw = checks.get(key)
        if raw is None or raw is False:
            continue
        if isinstance(raw, bool):
            sub = Decimal("1")
        else:
            try:
                sub = Decimal(str(raw))
            except Exception:
                sub = Decimal("1") if raw else Decimal("0")
        total += weight * sub
    return total.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def _bank_transfer_match(invoice_id: str, fx: FxResult, extracted: dict) -> MatchResult:
    """Scoring path for BANK_TRANSFER invoices.

    gmail_signal 0.50  · proof_match 0.30 · date_proximity 0.20
    Caps: no Gmail FOUND row → 0.5; no proof row → 0.7.
    """
    invoice = get_invoice(invoice_id)
    verification = get_latest_gmail_verification(invoice_id) or {}
    checks = verification.get("checks") or {}
    gmail_status = verification.get("status")
    gmail_present = gmail_status == "FOUND"

    proof_usable = _proof_signals_available(fx)

    amount_score, amount_diff = _amount_score(fx)
    if proof_usable:
        proof_date = _parse_proof_date(extracted.get("date"))
        date_score, date_diff = _date_score(proof_date, fx.paid_at)
        sender_score = _sender_score(extracted.get("sender"), invoice.get("client_name"))
        reference_score = _reference_score(extracted.get("reference"), invoice.get("invoice_no"))
    else:
        date_score = sender_score = reference_score = None
        date_diff = None

    signals = MatchSignals(
        amount_score=amount_score,
        date_score=date_score,
        sender_score=sender_score,
        reference_score=reference_score,
        amount_diff_ratio=amount_diff,
        date_diff_days=date_diff,
    )

    # Composite proof score = the same weighted blend used by STRIPE, scoped to
    # what we have. Falls back to None if no proof is usable.
    proof_score: Optional[Decimal]
    if proof_usable:
        proof_score = _combine(signals)
    else:
        proof_score = None

    gmail_score = _gmail_signal_score(checks) if gmail_present else None
    date_proximity_score = date_score  # proof date vs synthesised paid_at

    components: list[tuple[Decimal, Decimal]] = []
    if gmail_score is not None:
        components.append((BANK_WEIGHTS["gmail"], gmail_score))
    if proof_score is not None:
        components.append((BANK_WEIGHTS["proof"], proof_score))
    if date_proximity_score is not None:
        components.append((BANK_WEIGHTS["date_proximity"], date_proximity_score))

    if components:
        weight_sum = sum((w for w, _ in components), start=Decimal("0"))
        confidence = sum((w * s for w, s in components), start=Decimal("0")) / weight_sum
    else:
        confidence = Decimal("0")

    capped = False
    if not gmail_present and confidence > BANK_NO_GMAIL_CAP:
        confidence = BANK_NO_GMAIL_CAP
        capped = True
    if not fx.proof_present and confidence > BANK_NO_PROOF_CAP:
        confidence = BANK_NO_PROOF_CAP
        capped = True

    confidence = confidence.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    status = _threshold(confidence)

    reasons: list[str] = []
    reasons.append("This is a bank-transfer invoice — we corroborate the payment against the bank notification email and any uploaded receipt.")
    if gmail_score is not None:
        passed = [
            label for label, key in (
                ("matched the right bank account", "account_match"),
                ("matched the expected amount", "amount_match"),
                ("matched the invoice keyword", "keyword_match"),
                ("matched the currency", "currency_match"),
            ) if checks.get(key)
        ]
        failed = [
            label for label, key in (
                ("the bank account", "account_match"),
                ("the amount", "amount_match"),
                ("the invoice keyword", "keyword_match"),
                ("the currency", "currency_match"),
            ) if not checks.get(key)
        ]
        if passed and not failed:
            reasons.append("Found a matching bank notification email — every check passed.")
        elif passed:
            reasons.append(
                "Found a matching bank notification email — "
                + ", ".join(passed)
                + "; but did not match "
                + ", ".join(failed)
                + "."
            )
        else:
            reasons.append("Found a bank notification email, but none of the expected fields matched.")
    elif gmail_status == "NOT_FOUND":
        reasons.append("No matching bank notification email was found in the inbox yet.")
    else:
        reasons.append("Haven't searched the inbox for a bank notification email yet.")
    if proof_score is not None:
        reasons.append(_phrase_proof_score(proof_score))
    if date_proximity_score is not None and signals.date_diff_days is not None:
        reasons.append(_phrase_date(signals.date_diff_days))
    if not gmail_present:
        reasons.append(
            f"Without a confirmed bank notification email, confidence is capped at {BANK_NO_GMAIL_CAP}."
        )
    if not fx.proof_present:
        reasons.append(
            f"Without an uploaded receipt, confidence is capped at {BANK_NO_PROOF_CAP}."
        )

    if fx.proof_present:
        update_proof_match(invoice_id, status, confidence)
    update_invoice_status(invoice_id, status)

    return MatchResult(
        invoice_id=invoice_id,
        status=status,
        confidence=confidence,
        proof_present=fx.proof_present,
        capped=capped,
        signals=signals,
        fx=fx,
        reasons=reasons,
    )


def match(invoice_id: str) -> MatchResult:
    invoice = get_invoice(invoice_id)
    fx = resolve(invoice_id)
    extracted = get_latest_proof_extracted(invoice_id) or {}

    if invoice.get("payment_method") == "BANK_TRANSFER":
        return _bank_transfer_match(invoice_id, fx, extracted)

    proof_usable = _proof_signals_available(fx)

    amount_score, amount_diff = _amount_score(fx)

    if proof_usable:
        proof_date = _parse_proof_date(extracted.get("date"))
        date_score, date_diff = _date_score(proof_date, fx.paid_at)
        sender_score = _sender_score(extracted.get("sender"), invoice.get("client_name"))
        reference_score = _reference_score(extracted.get("reference"), invoice.get("invoice_no"))
    else:
        date_score = sender_score = reference_score = None
        date_diff = None

    signals = MatchSignals(
        amount_score=amount_score,
        date_score=date_score,
        sender_score=sender_score,
        reference_score=reference_score,
        amount_diff_ratio=amount_diff,
        date_diff_days=date_diff,
    )

    confidence = _combine(signals)
    capped = False
    if not proof_usable:
        # No verified proof signals — cap at 0.85 so we can never RECONCILE.
        capped_value = confidence * NO_PROOF_CAP
        if capped_value < confidence:
            capped = True
        confidence = capped_value

    confidence = confidence.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    status = _threshold(confidence)

    reasons = _build_reasons(fx, signals, proof_usable, capped, status)

    update_proof_match(invoice_id, status, confidence) if fx.proof_present else None
    update_invoice_status(invoice_id, status)

    return MatchResult(
        invoice_id=invoice_id,
        status=status,
        confidence=confidence,
        proof_present=fx.proof_present,
        capped=capped,
        signals=signals,
        fx=fx,
        reasons=reasons,
    )


def _phrase_proof_score(score: Decimal) -> str:
    s = float(score)
    if s >= 0.85:
        return f"The uploaded receipt strongly corroborates the payment (score {score})."
    if s >= 0.60:
        return f"The uploaded receipt partially corroborates the payment (score {score})."
    if s > 0:
        return f"The uploaded receipt doesn't line up well with the payment (score {score})."
    return "The uploaded receipt didn't contribute any usable signals."


def _phrase_amount(diff_ratio: Decimal) -> str:
    pct = (diff_ratio * 100).quantize(Decimal("0.01"))
    if pct == Decimal("0.00"):
        return "Amount on the receipt matches the bank credit exactly."
    if pct < Decimal("0.50"):
        return f"Amount on the receipt is within {pct}% of the bank credit — well inside tolerance."
    if pct < Decimal("2.00"):
        return f"Amount on the receipt differs from the bank credit by {pct}% — inside the ±2% tolerance."
    if pct < Decimal("5.00"):
        return f"Amount on the receipt is off by {pct}% — outside the ±2% tolerance but still scoring partially."
    return f"Amount on the receipt is off by {pct}% — outside tolerance, scoring zero."


def _phrase_date(days: int) -> str:
    if days == 0:
        return "Receipt is dated the same day as the bank credit."
    if days == 1:
        return "Receipt is dated 1 day from the bank credit."
    return f"Receipt is dated {days} days from the bank credit."


def _phrase_sender(score: Decimal) -> str:
    s = float(score)
    if s >= 0.90:
        return f"Sender name on the receipt is a near-exact match to the client ({score})."
    if s >= 0.60:
        return f"Sender name on the receipt mostly matches the client ({score})."
    if s > 0:
        return f"Sender name on the receipt does not look like the client ({score})."
    return "No sender name found on the receipt."


def _phrase_reference(score: Decimal) -> str:
    s = float(score)
    if s >= 0.99:
        return "Receipt reference includes the invoice number."
    if s >= 0.50:
        return f"Receipt reference partially matches the invoice number ({score})."
    if s > 0:
        return f"Receipt reference does not match the invoice number ({score})."
    return "No reference found on the receipt."


def _build_reasons(
    fx: FxResult,
    signals: MatchSignals,
    proof_usable: bool,
    capped: bool,
    status: Status,
) -> list[str]:
    del status  # status is shown alongside the reasons; no need to repeat it.
    out: list[str] = []
    if signals.amount_diff_ratio is not None:
        out.append(_phrase_amount(signals.amount_diff_ratio))
    if signals.date_diff_days is not None:
        out.append(_phrase_date(signals.date_diff_days))
    if signals.sender_score is not None:
        out.append(_phrase_sender(signals.sender_score))
    if signals.reference_score is not None:
        out.append(_phrase_reference(signals.reference_score))
    if not fx.proof_present:
        out.append(
            "No payment receipt uploaded yet — confidence is capped at 0.85, "
            "so this invoice can't auto-reconcile."
        )
    elif not proof_usable:
        out.append(
            "Couldn't read a clear currency from the receipt — confidence is capped at 0.85 "
            "until the receipt can be re-read."
        )
    elif capped:
        out.append("A safety cap was applied because one of the key signals was missing.")
    return out


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) != 2:
        print("usage: python -m backend.agents.matcher <invoice_id>", file=sys.stderr)
        sys.exit(2)
    result = match(sys.argv[1])
    print(json.dumps(result.model_dump(mode="json"), indent=2, default=str))
