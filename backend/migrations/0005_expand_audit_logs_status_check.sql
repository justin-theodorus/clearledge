-- 0005: Allow audit_logs to record pipeline ERROR and BANK_TRANSFER
-- AWAITING_TRANSFER states. Originally the matcher was the only writer, so
-- the check was scoped to its three outputs (RECONCILED/PARTIAL/UNVERIFIED).
-- The orchestrator's _record_error path needs ERROR, and the bank-transfer
-- path uses AWAITING_TRANSFER while the DBS notification email is still
-- pending.

alter table public.audit_logs
  drop constraint if exists audit_logs_status_check;
alter table public.audit_logs
  add constraint audit_logs_status_check
  check (status in ('RECONCILED','PARTIAL','UNVERIFIED','ERROR','AWAITING_TRANSFER'));
