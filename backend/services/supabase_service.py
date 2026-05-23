import os
from functools import lru_cache

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
