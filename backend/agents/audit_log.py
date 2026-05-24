import json
import logging
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import BaseModel

_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

from backend.agents.matcher import MatchResult, match
from backend.services.supabase_service import (
    get_latest_proof_id,
    insert_audit_log,
)

log = logging.getLogger(__name__)

AGENT_VERSION = "matcher@v1"


class AuditEntry(BaseModel):
    id: str
    invoice_id: str
    proof_id: Optional[str]
    status: str
    confidence: Decimal
    summary: str
    created_at: str


def _build_summary(result: MatchResult) -> str:
    s = result.signals
    parts: list[str] = [f"{result.status} at {result.confidence}"]
    if s.amount_diff_ratio is not None:
        pct = (s.amount_diff_ratio * Decimal("100")).quantize(Decimal("0.01"))
        parts.append(f"amount diff {pct}%")
    if s.date_diff_days is not None:
        parts.append(f"date off by {s.date_diff_days}d")
    if s.sender_score is not None:
        parts.append(f"sender {s.sender_score}")
    if s.reference_score is not None:
        parts.append(f"reference {s.reference_score}")
    if not result.proof_present:
        parts.append("no proof uploaded")
    if result.capped:
        parts.append("confidence capped")
    return " — ".join(parts)


def record(result: MatchResult) -> AuditEntry:
    """Persist a Matcher run snapshot. Primary entry point for the Orchestrator."""
    proof_id = get_latest_proof_id(result.invoice_id) if result.proof_present else None
    payload = {
        "invoice_id": result.invoice_id,
        "proof_id": proof_id,
        "status": result.status,
        "confidence": str(result.confidence),
        "proof_present": result.proof_present,
        "capped": result.capped,
        "signals": json.loads(result.signals.model_dump_json()),
        "fx": json.loads(result.fx.model_dump_json()),
        "reasons": result.reasons,
        "summary": _build_summary(result),
        "agent_version": AGENT_VERSION,
    }
    row = insert_audit_log(payload)
    return AuditEntry(
        id=row.get("id", ""),
        invoice_id=result.invoice_id,
        proof_id=proof_id,
        status=result.status,
        confidence=result.confidence,
        summary=payload["summary"],
        created_at=row.get("created_at") or datetime.utcnow().isoformat(),
    )


def record_for_invoice(invoice_id: str) -> AuditEntry:
    """CLI convenience: run the Matcher, then record. The Orchestrator will call
    `record(match_result)` directly instead of going through here."""
    result = match(invoice_id)
    return record(result)


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) != 2:
        print("usage: python -m backend.agents.audit_log <invoice_id>", file=sys.stderr)
        sys.exit(2)
    entry = record_for_invoice(sys.argv[1])
    print(json.dumps(entry.model_dump(mode="json"), indent=2, default=str))
