-- 0004: Bank-transfer payment method + Gmail OAuth token storage
--
-- Adds the BANK_TRANSFER payment rail. For this rail there is no Stripe
-- webhook, so the gmail_verifier agent reads the SME's Gmail for a bank
-- "money received" email and synthesises a transactions row. The refresh
-- token is encrypted at rest with pgcrypto; the symmetric key is supplied
-- per-call via the GMAIL_TOKEN_KEY env var and never stored in the DB.

create extension if not exists pgcrypto;

-- invoices.payment_method
alter table public.invoices
  add column if not exists payment_method text not null default 'STRIPE';
alter table public.invoices
  drop constraint if exists invoices_payment_method_check;
alter table public.invoices
  add constraint invoices_payment_method_check
  check (payment_method in ('STRIPE','BANK_TRANSFER'));

-- Extend invoices.status to include AWAITING_TRANSFER (BANK_TRANSFER initial state)
alter table public.invoices
  drop constraint if exists invoices_status_check;
alter table public.invoices
  add constraint invoices_status_check
  check (status in ('PENDING','AWAITING_TRANSFER','PAID','RECONCILED','PARTIAL','UNVERIFIED'));

-- gmail_tokens: single-row-per-SME (sme_id='default' for the MVP).
-- refresh_token_encrypted holds pgp_sym_encrypt(refresh_token, GMAIL_TOKEN_KEY).
create table if not exists public.gmail_tokens (
  id uuid primary key default gen_random_uuid(),
  sme_id text not null unique default 'default',
  google_email text not null,
  refresh_token_encrypted bytea not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz
);
alter table public.gmail_tokens enable row level security;

-- gmail_verifications: one row per gmail_verifier lookup, distinct from
-- audit_logs (which records matcher outcomes). Lets us trace why an invoice
-- did or did not get a synthetic transaction.
create table if not exists public.gmail_verifications (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  gmail_message_id text,
  checks jsonb not null default '{}'::jsonb,
  status text not null check (status in ('FOUND','NOT_FOUND','ACCOUNT_MISMATCH','ERROR','SKIPPED_NOT_BANK_TRANSFER')),
  created_transaction_id uuid references public.transactions(id) on delete set null,
  reason text,
  searched_at timestamptz not null default now()
);
alter table public.gmail_verifications enable row level security;

-- RPCs: encrypt/decrypt with the key passed in by the runtime (never
-- persisted). SECURITY DEFINER + service_role-only execute keeps callers
-- from needing pgcrypto privileges directly.
create or replace function public.gmail_token_set(
  p_sme_id text,
  p_google_email text,
  p_refresh_token text,
  p_scope text,
  p_key text
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.gmail_tokens (sme_id, google_email, refresh_token_encrypted, scope)
  values (p_sme_id, p_google_email, pgp_sym_encrypt(p_refresh_token, p_key), p_scope)
  on conflict (sme_id) do update set
    google_email = excluded.google_email,
    refresh_token_encrypted = excluded.refresh_token_encrypted,
    scope = excluded.scope,
    last_refreshed_at = now();
end;
$$;

create or replace function public.gmail_token_get(
  p_sme_id text,
  p_key text
) returns table (
  google_email text,
  refresh_token text,
  scope text,
  connected_at timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select
    t.google_email,
    pgp_sym_decrypt(t.refresh_token_encrypted, p_key)::text as refresh_token,
    t.scope,
    t.connected_at
  from public.gmail_tokens t
  where t.sme_id = p_sme_id;
end;
$$;

revoke all on function public.gmail_token_set(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.gmail_token_get(text,text) from public, anon, authenticated;
grant execute on function public.gmail_token_set(text,text,text,text,text) to service_role;
grant execute on function public.gmail_token_get(text,text) to service_role;
