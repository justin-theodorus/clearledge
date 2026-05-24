#!/usr/bin/env bash
# clear_proofs_bucket.sh — wipe every object in the Supabase `proofs` bucket.
#
# Postgres can't delete from storage.objects directly (storage.protect_delete
# trigger blocks it), so reset.sql leaves uploaded receipts behind. Run this
# alongside reset.sql to fully return to the seeded baseline.
#
# Requires PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env.
# Usage: bash backend/scripts/clear_proofs_bucket.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${PUBLIC_SUPABASE_URL:?PUBLIC_SUPABASE_URL not set}"
: "${SUPABASE_SECRET_KEY:?SUPABASE_SECRET_KEY not set}"

BUCKET="proofs"
LIST_URL="${PUBLIC_SUPABASE_URL}/storage/v1/object/list/${BUCKET}"
DELETE_URL="${PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}"

# Walk every top-level prefix (invoices/<uuid>/), list files inside, then bulk-delete.
paths_json=$(
  curl -sS -X POST "$LIST_URL" \
    -H "apikey: ${SUPABASE_SECRET_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"prefix":"","limit":1000}' \
  | python3 -c '
import json, sys, urllib.request

base   = sys.argv[1].rstrip("/")
bucket = sys.argv[2]
token  = sys.argv[3]

prefixes = [row["name"] for row in json.load(sys.stdin) if isinstance(row, dict) and row.get("name")]
all_paths = []
for prefix in prefixes:
    req = urllib.request.Request(
        f"{base}/storage/v1/object/list/{bucket}",
        data=json.dumps({"prefix": prefix, "limit": 1000}).encode(),
        headers={
            "apikey": token,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        rows = json.loads(r.read())
    for row in rows:
        name = row.get("name")
        if not name:
            continue
        all_paths.append(f"{prefix}/{name}")
print(json.dumps(all_paths))
' "$PUBLIC_SUPABASE_URL" "$BUCKET" "$SUPABASE_SECRET_KEY"
)

count=$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])))' "$paths_json")

if [[ "$count" == "0" ]]; then
  echo "proofs bucket already empty"
  exit 0
fi

body=$(python3 -c 'import json,sys; print(json.dumps({"prefixes": json.loads(sys.argv[1])}))' "$paths_json")

curl -sS -X DELETE "$DELETE_URL" \
  -H "apikey: ${SUPABASE_SECRET_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -d "$body" >/dev/null

echo "deleted ${count} object(s) from ${BUCKET}"
