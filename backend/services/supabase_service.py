import os
from decimal import Decimal
from functools import lru_cache
from typing import Optional

from supabase import Client, create_client
from supabase.client import ClientOptions


class ProofNotFoundError(Exception):
    pass


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    url = os.environ["PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SECRET_KEY"]
    return create_client(
        url,
        key,
        options=ClientOptions(auto_refresh_token=False, persist_session=False),
    )


def get_latest_proof_url(invoice_id: str) -> str:
    client = get_supabase()
    res = (
        client.table("proofs")
        .select("proof_url")
        .eq("invoice_id", invoice_id)
        .order("uploaded_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise ProofNotFoundError(f"No proof found for invoice_id={invoice_id}")
    return rows[0]["proof_url"]


class TransactionNotFoundError(Exception):
    pass


class InvoiceNotFoundError(Exception):
    pass


def get_invoice(invoice_id: str) -> dict:
    client = get_supabase()
    res = (
        client.table("invoices")
        .select("id,invoice_no,client_name,amount,currency,payment_method,status,created_at")
        .eq("id", invoice_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise InvoiceNotFoundError(f"No invoice found for id={invoice_id}")
    return rows[0]


def get_transaction_for_invoice(invoice_id: str) -> dict:
    client = get_supabase()
    res = (
        client.table("transactions")
        .select("amount_received,currency_received,paid_at")
        .eq("invoice_id", invoice_id)
        .order("paid_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise TransactionNotFoundError(
            f"No transaction found for invoice_id={invoice_id}"
        )
    return rows[0]


def get_latest_proof_extracted(invoice_id: str) -> Optional[dict]:
    client = get_supabase()
    res = (
        client.table("proofs")
        .select("extracted_data")
        .eq("invoice_id", invoice_id)
        .order("uploaded_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return None
    return rows[0].get("extracted_data")


def get_latest_proof_id(invoice_id: str) -> Optional[str]:
    client = get_supabase()
    res = (
        client.table("proofs")
        .select("id")
        .eq("invoice_id", invoice_id)
        .order("uploaded_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0]["id"] if rows else None


def update_latest_proof_extracted(invoice_id: str, payload: dict) -> None:
    proof_id = get_latest_proof_id(invoice_id)
    if not proof_id:
        raise ProofNotFoundError(f"No proof found for invoice_id={invoice_id}")
    client = get_supabase()
    client.table("proofs").update({"extracted_data": payload}).eq("id", proof_id).execute()


def update_proof_match(invoice_id: str, status: str, confidence: Decimal) -> None:
    proof_id = get_latest_proof_id(invoice_id)
    if not proof_id:
        raise ProofNotFoundError(f"No proof found for invoice_id={invoice_id}")
    client = get_supabase()
    client.table("proofs").update(
        {"match_status": status, "match_confidence": str(confidence)}
    ).eq("id", proof_id).execute()


def update_invoice_status(invoice_id: str, status: str) -> None:
    client = get_supabase()
    client.table("invoices").update({"status": status}).eq("id", invoice_id).execute()


def insert_audit_log(payload: dict) -> dict:
    client = get_supabase()
    res = client.table("audit_logs").insert(payload).execute()
    rows = res.data or []
    return rows[0] if rows else {}


def insert_transaction(payload: dict) -> dict:
    client = get_supabase()
    res = client.table("transactions").insert(payload).execute()
    rows = res.data or []
    return rows[0] if rows else {}


def insert_gmail_verification(payload: dict) -> dict:
    client = get_supabase()
    res = client.table("gmail_verifications").insert(payload).execute()
    rows = res.data or []
    return rows[0] if rows else {}


def get_latest_gmail_verification(invoice_id: str) -> Optional[dict]:
    client = get_supabase()
    res = (
        client.table("gmail_verifications")
        .select("status,checks,gmail_message_id,created_transaction_id,searched_at")
        .eq("invoice_id", invoice_id)
        .order("searched_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def get_gmail_token(sme_id: str = "default") -> Optional[dict]:
    key = os.environ.get("GMAIL_TOKEN_KEY")
    if not key:
        raise RuntimeError("GMAIL_TOKEN_KEY env var is required to decrypt gmail tokens")
    client = get_supabase()
    res = client.rpc("gmail_token_get", {"p_sme_id": sme_id, "p_key": key}).execute()
    rows = res.data or []
    return rows[0] if rows else None
