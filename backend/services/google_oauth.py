"""Helpers for using the SME's Gmail refresh token to drive the Gmail API.

Tokens are stored encrypted in Supabase (`gmail_tokens`) and decrypted via the
`gmail_token_get` RPC, which expects the symmetric key via
``GMAIL_TOKEN_KEY``. We never persist the key in the DB.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import Resource, build

from backend.services.supabase_service import get_gmail_token

GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"


class GmailNotConnectedError(Exception):
    pass


def _build_credentials(refresh_token: str, scope: str) -> Credentials:
    client_id = os.environ["GOOGLE_CLIENT_ID"]
    client_secret = os.environ["GOOGLE_CLIENT_SECRET"]
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri=GOOGLE_TOKEN_URI,
        client_id=client_id,
        client_secret=client_secret,
        scopes=[scope],
    )
    creds.refresh(Request())
    return creds


@lru_cache(maxsize=1)
def get_gmail_client(sme_id: str = "default") -> Resource:
    row = get_gmail_token(sme_id)
    if not row:
        raise GmailNotConnectedError(
            f"No Gmail token stored for sme_id={sme_id}. Connect Gmail in Settings first."
        )
    creds = _build_credentials(row["refresh_token"], row.get("scope") or GMAIL_SCOPE)
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def get_connected_email(sme_id: str = "default") -> Optional[str]:
    row = get_gmail_token(sme_id)
    return row.get("google_email") if row else None
