-- reset.sql — wipe all reconciliation data back to an empty state.
--
-- Preserves: public.gmail_tokens (the SME's connected Gmail OAuth survives).
-- Wipes:    public.invoices, public.transactions, public.proofs,
--           public.audit_logs, public.gmail_verifications.
--
-- This script does NOT clear the `proofs` storage bucket — Postgres can't
-- delete from storage.objects directly. Run scripts/clear_proofs_bucket.sh
-- alongside this (or before re-seeding) to wipe uploaded receipts.
--
-- Reset workflow:
--   1. psql/MCP: \i backend/scripts/reset.sql
--   2. shell:    bash backend/scripts/clear_proofs_bucket.sh
--   3. psql/MCP: \i backend/scripts/seed.sql

begin;

truncate table public.audit_logs,
              public.gmail_verifications,
              public.proofs,
              public.transactions,
              public.invoices
  restart identity cascade;

commit;
