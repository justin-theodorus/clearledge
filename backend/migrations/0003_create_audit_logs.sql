create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  proof_id uuid references public.proofs(id) on delete set null,
  status text not null check (status in ('RECONCILED','PARTIAL','UNVERIFIED')),
  confidence numeric(4,3) not null,
  proof_present boolean not null,
  capped boolean not null,
  signals jsonb not null,
  fx jsonb not null,
  reasons jsonb not null,
  summary text not null,
  agent_version text not null default 'matcher@v1',
  created_at timestamptz not null default now()
);
create index audit_logs_invoice_id_idx on public.audit_logs (invoice_id, created_at desc);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
alter table public.audit_logs enable row level security;
