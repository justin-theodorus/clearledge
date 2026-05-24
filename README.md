<p align="center">
  <img src="frontend/public/logo/standalone-removebg-preview.png" alt="ClearLedge" width="420" />
</p>

# ClearLedge

**AI-powered treasury reconciliation for Southeast Asian SMEs handling cross-border payments.**

ClearLedge auto-generates invoices, collects payments via Stripe (with regional methods like PayNow, PromptPay, FPX, GrabPay), reconciles them in real time against the bank ledger using FX-aware logic, and runs a multi-agent AI pipeline to verify client-uploaded payment proofs.

---

## Table of Contents

- [Architecture](#architecture)
- [System Requirements](#system-requirements)
- [Dependencies](#dependencies)
- [Setup](#setup)
  - [1. Clone the repository](#1-clone-the-repository)
  - [2. Provision external services](#2-provision-external-services)
  - [3. Configure Supabase schema](#3-configure-supabase-schema)
  - [4. Configure the frontend](#4-configure-the-frontend)
  - [5. Configure the backend agents](#5-configure-the-backend-agents)
- [Running the App](#running-the-app)
  - [Frontend (Next.js)](#frontend-nextjs)
  - [Stripe Webhook (local)](#stripe-webhook-local)
  - [Backend AI Agents](#backend-ai-agents)
- [Project Layout](#project-layout)

---

## Architecture

Two independent components share a single Supabase database:

1. **`frontend/`** — Next.js 16 (App Router, React 19, TypeScript, Tailwind v4). Owns all HTTP surface area: invoice CRUD, Stripe checkout, Stripe webhook, proof upload, dashboard, PDF rendering. Talks directly to Stripe, Supabase, Resend, Frankfurter (FX), and Gmail.
2. **`backend/`** — Python agent pipeline (no server). Standalone CLI modules under `backend/agents/` that read/write Supabase directly and call Chutes (LLM) and Frankfurter (FX). Runnable as `python -m backend.agents.<name> <invoice_id>`.

```
Invoice created (Next.js) → Resend email with pay link
  → Stripe Checkout (regional payment method, FX-converted) → Stripe webhook → transactions + invoices.PAID
  → Client uploads proof → Supabase Storage
  → AI pipeline (backend) → Extractor (Chutes Gemma vision)
                          → FX Resolver (Frankfurter)
                          → Matcher (amount/date/sender/reference scoring) → RECONCILED / PARTIAL / UNVERIFIED
                          → Audit Log + Gmail Verifier + Orchestrator
```

See `ARCHITECTURE.md`, `PRD.md`, and `CLAUDE.md` for deeper detail.

---

## System Requirements

| Requirement | Version |
|---|---|
| Node.js | ≥ 20.x (Next.js 16) |
| npm | ≥ 10.x |
| Python | ≥ 3.10 |
| Git | any recent |
| OS | macOS / Linux / WSL2 |
| `ngrok` (or any tunnel) | for local Stripe webhook testing |

### External service accounts

You will need accounts (free tiers are sufficient) for:

- **Supabase** — Postgres + Storage
- **Stripe** — test mode is fine
- **Resend** — transactional email (sandbox mode delivers only to the signup email)
- **Chutes.ai** — LLM provider (Gemma vision + DeepSeek reasoning)
- **Google Cloud** — Gmail API OAuth credentials (for the Gmail verifier agent)

---

## Dependencies

### Frontend (`frontend/package.json`)
- `next@16`, `react@19`, `typescript@5`, `tailwindcss@4`
- `@supabase/supabase-js`, `@supabase/ssr`
- `stripe`
- `resend`
- `@react-pdf/renderer`
- `googleapis`
- `lucide-react`

### Backend (`backend/requirements.txt`)
- `supabase>=2.9`
- `openai>=1.50` (used against the Chutes OpenAI-compatible endpoint)
- `pydantic>=2.7`
- `python-dotenv>=1.0`
- `rapidfuzz>=3.0`
- `httpx>=0.27`
- `google-auth>=2.30`, `google-api-python-client>=2.140`

---

## Setup

### 1. Clone the repository

```bash
git clone <repo-url> clearledge
cd clearledge
```

### 2. Provision external services

1. **Supabase project** — create one, then copy the project URL and the *secret* API key (`sb_secret_…`). The new Supabase key model (Jul 2025) replaces the legacy `service_role` JWT — use `SUPABASE_SECRET_KEY`.
2. **Stripe** — get your test-mode `sk_test_…` key.
3. **Resend** — create an API key. Note the email you signed up with — in sandbox mode Resend will only deliver to that address.
4. **Chutes.ai** — create an API key. Identify a Gemma vision model id and a DeepSeek reasoning model id.
5. **Google Cloud** — create an OAuth 2.0 Desktop client with the Gmail read scope. Download the credentials JSON.

### 3. Configure Supabase schema

Run the SQL migrations in order against your Supabase project (via the Supabase SQL editor or the Supabase MCP):

```
backend/migrations/0001_create_core_schema.sql
backend/migrations/0002_create_proofs_storage_bucket.sql
backend/migrations/0003_create_audit_logs.sql
backend/migrations/0004_add_payment_method_and_gmail_tokens.sql
backend/migrations/0005_expand_audit_logs_status_check.sql
backend/migrations/0006_seed_demo_data.sql        # optional — seeds demo rows
```

This creates the `invoices`, `transactions`, `proofs`, `audit_logs` tables and the `proofs` Storage bucket.

### 4. Configure the frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # if present; otherwise create the file
```

Fill in `frontend/.env.local`:

```bash
PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...      # filled in after step "Stripe Webhook (local)" below

RESEND_API_KEY=re_...
RESEND_SIGNUP_EMAIL=you@example.com  # sandbox: only this address actually receives mail

NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 5. Configure the backend agents

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```bash
PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...

CHUTES_API_KEY=...
CHUTES_GEMMA_MODEL=<gemma-vision-model-id>
CHUTES_DEEPSEEK_MODEL=<deepseek-model-id>

GMAIL_TOKEN_KEY=<gmail-token-key>
GOOGLE_CLIENT_ID=<google-oauth-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>

SME_ACCOUNT_NUMBER=<bank-account-number>
```

> `backend/.env` and `frontend/.env.local` are gitignored. Never commit secrets.

---

## Running the App

### Frontend (Next.js)

From `frontend/`:

```bash
npm run dev      # http://localhost:3000
# other commands
npm run build
npm run start
npm run lint
```

Visit:
- `/invoices/new` — create an invoice (this also sends the pay-link email via Resend)
- `/invoices/[id]/pay` — pick a region and pay via Stripe Checkout
- `/invoices/[id]/proof` — upload a payment proof image
- `/invoices/[id]` — see invoice + transaction + reconciliation status
- `/dashboard` — overview

### Stripe Webhook (local)

The webhook at `POST /api/stripe/webhook` is what writes the `transactions` row and flips an invoice to `PAID`. To exercise it locally:

```bash
# in a second terminal
ngrok http 3000
```

In the Stripe dashboard:
1. Add a webhook endpoint pointing at `https://<your-ngrok>.ngrok-free.app/api/stripe/webhook`.
2. Subscribe to event `checkout.session.completed`.
3. Copy the signing secret (`whsec_…`) and put it in `frontend/.env.local` as `STRIPE_WEBHOOK_SECRET`. Restart `npm run dev`.

### Backend AI Agents

Agents are runnable as Python modules. **Run them from the repo root** so the `backend.` import prefix resolves:

```bash
# from repo root, with backend/.venv active
python -m backend.agents.extractor    <invoice_id>   # OCR/vision over the uploaded proof
python -m backend.agents.fx_resolver  <invoice_id>   # resolves invoice→txn + proof→txn FX legs
python -m backend.agents.matcher      <invoice_id>   # scores + writes match_status, invoice.status
python -m backend.agents.gmail_verifier <invoice_id> # cross-checks against Gmail bank notifications
python -m backend.agents.audit_log    <invoice_id>   # writes a reasoning trace to audit_logs
python -m backend.agents.orchestrator <invoice_id>   # runs the full pipeline
```

Each module reads/writes Supabase directly, prints a JSON result, and (where applicable) updates the invoice's reconciliation status.

**Reconciliation thresholds** (in `backend/agents/matcher.py`):
- confidence `> 0.85` → `RECONCILED`
- `0.5 – 0.85` → `PARTIAL`
- `< 0.5` → `UNVERIFIED`
- Without a verified proof, confidence is capped at `0.85` so we never auto-RECONCILE blindly.

---

## Project Layout

```
clearledge/
├── frontend/                 # Next.js 16 app (all HTTP surface area)
│   ├── app/
│   │   ├── api/              # invoices, checkout, stripe webhook, proof upload
│   │   ├── invoices/         # new / [id] / pay / proof pages
│   │   ├── dashboard/
│   │   ├── lib/
│   │   │   ├── server/       # supabase, stripe, fx, resend singletons
│   │   │   └── regions.ts    # SG/US/TH/MY currency + payment methods
│   │   └── components/       # InvoicePdf, UI components
│   └── package.json
├── backend/                  # Python agent pipeline (no server)
│   ├── agents/
│   │   ├── extractor.py      # Chutes Gemma vision → JSON proof fields
│   │   ├── fx_resolver.py    # Frankfurter FX legs at paid_date
│   │   ├── matcher.py        # scoring + threshold → status
│   │   ├── gmail_verifier.py # Gmail bank-notification cross-check
│   │   ├── audit_log.py      # writes audit_logs entries
│   │   └── orchestrator.py   # runs the pipeline end-to-end
│   ├── services/             # supabase_service, chutes_client
│   ├── migrations/           # SQL migrations (run in order)
│   └── requirements.txt
```

---

## License

Hackathon MVP — no license granted. Do not redistribute without permission.
