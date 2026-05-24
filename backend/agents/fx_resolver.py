import json
import logging
from datetime import date as date_type
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Literal, Optional

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel

_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

from backend.agents.extractor import extract
from backend.services.supabase_service import (
    ProofNotFoundError,
    get_invoice,
    get_latest_proof_extracted,
    get_transaction_for_invoice,
)

log = logging.getLogger(__name__)

FRANKFURTER_BASE = "https://api.frankfurter.app"

LegStatus = Literal[
    "RESOLVED",
    "SAME_CURRENCY",
    "NO_OCR_CURRENCY",
]


class FxResolutionError(Exception):
    pass


class FxLeg(BaseModel):
    status: LegStatus
    from_currency: Optional[str] = None
    to_currency: str
    rate: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    amount_converted: Optional[Decimal] = None
    rate_date: Optional[date_type] = None
    reason: Optional[str] = None


class FxResult(BaseModel):
    invoice_id: str
    txn_amount: Decimal
    txn_currency: str
    paid_at: datetime
    invoice_to_txn: FxLeg
    proof_to_txn: Optional[FxLeg] = None
    proof_present: bool
    fx_timestamp: datetime


def _parse_paid_at(value) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    raise FxResolutionError(f"Unrecognized paid_at value: {value!r}")


def _to_decimal(value) -> Optional[Decimal]:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except Exception:
        return None


def _load_ocr_currency_and_amount(
    invoice_id: str,
) -> tuple[Optional[str], Optional[Decimal], bool]:
    """Returns (currency, amount, proof_exists)."""
    extracted = get_latest_proof_extracted(invoice_id)
    if extracted:
        currency = extracted.get("currency")
        amount = _to_decimal(extracted.get("amount"))
        return (currency.upper() if currency else None), amount, True

    log.info("FX: no extracted_data on proofs row; invoking extractor directly")
    try:
        proof = extract(invoice_id)
    except ProofNotFoundError:
        return None, None, False
    currency = proof.currency.upper() if proof.currency else None
    return currency, proof.amount, True


def _fetch_frankfurter(rate_date: date_type, from_ccy: str, to_ccy: str) -> tuple[Decimal, date_type]:
    url = f"{FRANKFURTER_BASE}/{rate_date.isoformat()}"
    params = {"from": from_ccy, "to": to_ccy}
    resp = httpx.get(url, params=params, timeout=15, follow_redirects=True)
    if resp.status_code != 200:
        raise FxResolutionError(
            f"Frankfurter returned {resp.status_code} for {from_ccy}->{to_ccy} on {rate_date}: {resp.text}"
        )
    data = resp.json()
    rates = data.get("rates") or {}
    if to_ccy not in rates:
        raise FxResolutionError(
            f"Frankfurter response missing rate for {to_ccy} (from={from_ccy}, date={rate_date}): {data}"
        )
    rate = Decimal(str(rates[to_ccy]))
    returned_date = date_type.fromisoformat(data.get("date", rate_date.isoformat()))
    return rate, returned_date


def _convert(amount: Optional[Decimal], rate: Decimal) -> Optional[Decimal]:
    if amount is None:
        return None
    return (amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _resolve_leg(
    from_currency: Optional[str],
    to_currency: str,
    amount: Optional[Decimal],
    paid_date: date_type,
) -> FxLeg:
    if not from_currency:
        return FxLeg(
            status="NO_OCR_CURRENCY",
            to_currency=to_currency,
            amount=amount,
            rate_date=paid_date,
            reason="OCR could not determine a currency from the proof image",
        )

    if from_currency == to_currency:
        return FxLeg(
            status="SAME_CURRENCY",
            from_currency=from_currency,
            to_currency=to_currency,
            rate=Decimal("1"),
            amount=amount,
            amount_converted=amount,
            rate_date=paid_date,
        )

    rate, rate_date = _fetch_frankfurter(paid_date, from_currency, to_currency)
    return FxLeg(
        status="RESOLVED",
        from_currency=from_currency,
        to_currency=to_currency,
        rate=rate,
        amount=amount,
        amount_converted=_convert(amount, rate),
        rate_date=rate_date,
    )


def resolve(invoice_id: str) -> FxResult:
    invoice = get_invoice(invoice_id)
    txn = get_transaction_for_invoice(invoice_id)

    to_currency = (txn["currency_received"] or "").upper()
    if not to_currency:
        raise FxResolutionError(
            f"Transaction has no currency_received for invoice_id={invoice_id}"
        )
    invoice_currency = (invoice["currency"] or "").upper()
    if not invoice_currency:
        raise FxResolutionError(
            f"Invoice has no currency for invoice_id={invoice_id}"
        )

    paid_at = _parse_paid_at(txn["paid_at"])
    paid_date = paid_at.date()
    now_utc = datetime.now(timezone.utc)
    invoice_amount = _to_decimal(invoice["amount"])

    invoice_leg = _resolve_leg(invoice_currency, to_currency, invoice_amount, paid_date)

    proof_currency, proof_amount, proof_present = _load_ocr_currency_and_amount(invoice_id)
    proof_leg: Optional[FxLeg] = None
    if proof_present:
        proof_leg = _resolve_leg(proof_currency, to_currency, proof_amount, paid_date)

    txn_amount = _to_decimal(txn["amount_received"])
    if txn_amount is None:
        raise FxResolutionError(
            f"Transaction has no amount_received for invoice_id={invoice_id}"
        )

    return FxResult(
        invoice_id=invoice_id,
        txn_amount=txn_amount,
        txn_currency=to_currency,
        paid_at=paid_at,
        invoice_to_txn=invoice_leg,
        proof_to_txn=proof_leg,
        proof_present=proof_present,
        fx_timestamp=now_utc,
    )


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) != 2:
        print("usage: python -m backend.agents.fx_resolver <invoice_id>", file=sys.stderr)
        sys.exit(2)
    result = resolve(sys.argv[1])
    print(json.dumps(result.model_dump(mode="json"), indent=2, default=str))
