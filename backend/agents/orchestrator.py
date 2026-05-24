import json
import logging
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

from backend.agents.audit_log import AuditEntry, record
from backend.agents.extractor import extract
from backend.agents.fx_resolver import resolve
from backend.agents.gmail_verifier import verify as gmail_verify
from backend.agents.matcher import match
from backend.services.supabase_service import (
    TransactionNotFoundError,
    get_invoice,
    get_latest_proof_id,
    get_transaction_for_invoice,
    insert_audit_log,
    update_invoice_status,
    update_latest_proof_extracted,
)

log = logging.getLogger(__name__)

AGENT_VERSION = "orchestrator@v1"


def _record_awaiting_transfer(invoice_id: str) -> AuditEntry:
    """BANK_TRANSFER and no transaction row yet — the DBS email hasn't been
    matched. Record a clear audit entry and leave the invoice status alone
    (the verifier writes its own gmail_verifications row with the search
    outcome)."""
    proof_id = get_latest_proof_id(invoice_id)
    summary = "Awaiting bank confirmation — no matching DBS email yet"
    payload = {
        "invoice_id": invoice_id,
        "proof_id": proof_id,
        "status": "AWAITING_TRANSFER",
        "confidence": "0",
        "proof_present": proof_id is not None,
        "capped": False,
        "signals": {},
        "fx": {},
        "reasons": [
            "BANK_TRANSFER invoice with no transactions row yet",
            "Gmail verifier did not find a DBS 'received a transfer' email matching this invoice",
            "Retry-once will re-run the pipeline in ~5 minutes; press Retry to try again sooner",
        ],
        "summary": summary,
        "agent_version": AGENT_VERSION,
    }
    row = insert_audit_log(payload)
    update_invoice_status(invoice_id, "AWAITING_TRANSFER")
    return AuditEntry(
        id=row.get("id", ""),
        invoice_id=invoice_id,
        proof_id=proof_id,
        status="AWAITING_TRANSFER",
        confidence=0,  # type: ignore[arg-type]
        summary=summary,
        created_at=row.get("created_at") or datetime.utcnow().isoformat(),
    )


def _record_error(invoice_id: str, step: str, err: Exception) -> AuditEntry:
    proof_id = get_latest_proof_id(invoice_id)
    summary = f"ERROR at {step}: {err.__class__.__name__}: {err}"
    payload = {
        "invoice_id": invoice_id,
        "proof_id": proof_id,
        "status": "ERROR",
        "confidence": "0",
        "proof_present": proof_id is not None,
        "capped": False,
        "signals": {},
        "fx": {},
        "reasons": [f"Pipeline failed at step '{step}': {err}"],
        "summary": summary,
        "agent_version": AGENT_VERSION,
    }
    row = insert_audit_log(payload)
    return AuditEntry(
        id=row.get("id", ""),
        invoice_id=invoice_id,
        proof_id=proof_id,
        status="ERROR",
        confidence=0,  # type: ignore[arg-type]
        summary=summary,
        created_at=row.get("created_at") or datetime.utcnow().isoformat(),
    )


def orchestrate(invoice_id: str) -> AuditEntry:
    """Run the agent pipeline.

    STRIPE invoices: extract (if proof) → fx_resolve → match → audit_log.
    BANK_TRANSFER invoices: gmail_verify → (rest same). gmail_verify creates
    the synthetic transactions row that fx_resolve depends on.
    """
    log.info("[orchestrator] start invoice=%s", invoice_id)

    invoice = get_invoice(invoice_id)
    is_bank_transfer = invoice.get("payment_method") == "BANK_TRANSFER"
    if is_bank_transfer:
        try:
            log.info("[orchestrator] step=gmail_verify")
            gmail_verify(invoice_id)
        except Exception as e:
            log.exception("[orchestrator] gmail_verify failed")
            return _record_error(invoice_id, "gmail_verify", e)

    # For BANK_TRANSFER, fx_resolve and match both need a transactions row.
    # If gmail_verify didn't (yet) synthesise one, record an "awaiting bank
    # confirmation" entry and exit — the retry-once timer will run the
    # pipeline again in ~5 minutes.
    if is_bank_transfer:
        try:
            get_transaction_for_invoice(invoice_id)
        except TransactionNotFoundError:
            log.info("[orchestrator] BANK_TRANSFER — no transaction yet, recording AWAITING_TRANSFER")
            return _record_awaiting_transfer(invoice_id)

    proof_id = get_latest_proof_id(invoice_id)

    if proof_id is not None:
        try:
            log.info("[orchestrator] step=extract proof=%s", proof_id)
            extracted = extract(invoice_id)
            update_latest_proof_extracted(
                invoice_id, json.loads(extracted.model_dump_json())
            )
        except Exception as e:
            log.exception("[orchestrator] extract failed")
            return _record_error(invoice_id, "extract", e)
    else:
        log.info("[orchestrator] no proof — skipping extract")

    try:
        log.info("[orchestrator] step=fx_resolve")
        resolve(invoice_id)
    except Exception as e:
        log.exception("[orchestrator] fx_resolve failed")
        return _record_error(invoice_id, "fx_resolve", e)

    try:
        log.info("[orchestrator] step=match")
        result = match(invoice_id)
    except Exception as e:
        log.exception("[orchestrator] match failed")
        return _record_error(invoice_id, "match", e)

    try:
        log.info("[orchestrator] step=audit_log")
        entry = record(result)
    except Exception as e:
        log.exception("[orchestrator] audit_log failed")
        return _record_error(invoice_id, "audit_log", e)

    log.info(
        "[orchestrator] done invoice=%s status=%s confidence=%s",
        invoice_id,
        entry.status,
        entry.confidence,
    )
    return entry


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) != 2:
        print("usage: python -m backend.agents.orchestrator <invoice_id>", file=sys.stderr)
        sys.exit(2)
    entry = orchestrate(sys.argv[1])
    print(json.dumps(entry.model_dump(mode="json"), indent=2, default=str))
