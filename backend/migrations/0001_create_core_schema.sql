create extension if not exists "pgcrypto";

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  client_name text not null,
  client_email text not null,
  amount numeric(14,2) not null,
  currency text not null,
  due_date date,
  stripe_session_id text,
  payment_link text,
  status text not null default 'PENDING'
    check (status in ('PENDING','PAID','RECONCILED','PARTIAL','UNVERIFIED')),
  created_at timestamptz not null default now()
);

create index invoices_status_idx on public.invoices (status);
create index invoices_created_at_idx on public.invoices (created_at desc);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount_received numeric(14,2) not null,
  currency_received text not null,
  amount_converted numeric(14,2),
  fx_rate numeric(18,8),
  fx_timestamp timestamptz,
  stripe_payment_intent text,
  paid_at timestamptz not null default now()
);

create index transactions_invoice_id_idx on public.transactions (invoice_id);

create table public.proofs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  proof_url text not null,
  extracted_data jsonb,
  match_confidence numeric(4,3) check (match_confidence between 0 and 1),
  match_status text check (match_status in ('RECONCILED','PARTIAL','UNVERIFIED')),
  uploaded_at timestamptz not null default now()
);

create index proofs_invoice_id_idx on public.proofs (invoice_id);

alter table public.invoices enable row level security;
alter table public.transactions enable row level security;
alter table public.proofs enable row level security;
