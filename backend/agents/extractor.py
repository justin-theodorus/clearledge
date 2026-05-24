import base64
import json
import logging
import mimetypes
import os
import re
from datetime import date as date_type
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

from backend.services.chutes_client import get_chutes_client
from backend.services.supabase_service import get_latest_proof_url

log = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a payment-proof OCR extractor. "
    "Return ONLY a single JSON object with these keys: "
    "amount (number), currency (3-letter ISO 4217 code), sender (string), "
    "date (YYYY-MM-DD), reference (string). "
    "Use null for any field you cannot determine. No prose, no code fences."
)


class ExtractedProof(BaseModel):
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    sender: Optional[str] = None
    date: Optional[date_type] = None
    reference: Optional[str] = None
    raw_response: str = Field(default="")

    @field_validator("currency")
    @classmethod
    def _upper_currency(cls, v: Optional[str]) -> Optional[str]:
        return v.upper() if isinstance(v, str) else v

    @field_validator("amount", mode="before")
    @classmethod
    def _coerce_amount(cls, v):
        if v is None or v == "":
            return None
        try:
            return Decimal(str(v).replace(",", ""))
        except (InvalidOperation, ValueError):
            return None


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


def _fetch_as_data_url(url: str) -> str:
    resp = httpx.get(url, timeout=30, follow_redirects=True)
    resp.raise_for_status()
    mime = resp.headers.get("content-type", "").split(";")[0].strip()
    if not mime:
        guessed, _ = mimetypes.guess_type(urlparse(url).path)
        mime = guessed or "image/png"
    b64 = base64.b64encode(resp.content).decode("ascii")
    return f"data:{mime};base64,{b64}"


def extract(invoice_id: str) -> ExtractedProof:
    proof_url = get_latest_proof_url(invoice_id)
    image_payload = _fetch_as_data_url(proof_url)
    client = get_chutes_client()
    model = os.environ["CHUTES_GEMMA_MODEL"]

    completion = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_payload}},
                    {"type": "text", "text": "Extract the payment details."},
                ],
            },
        ],
    )

    raw = completion.choices[0].message.content or ""
    parsed = _extract_json(raw)
    if parsed is None:
        log.warning("Extractor: could not parse JSON from model response")
        return ExtractedProof(raw_response=raw)

    try:
        return ExtractedProof(**parsed, raw_response=raw)
    except Exception:
        log.exception("Extractor: pydantic validation failed; returning empty result")
        return ExtractedProof(raw_response=raw)


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) != 2:
        print("usage: python -m backend.agents.extractor <invoice_id>", file=sys.stderr)
        sys.exit(2)
    result = extract(sys.argv[1])
    print(json.dumps(result.model_dump(mode="json"), indent=2, default=str))
