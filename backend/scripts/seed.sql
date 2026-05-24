-- seed.sql — re-seed the demo dataset used by the redesigned frontend.
--
-- Idempotent: truncates the reconciliation tables first, then inserts. Safe
-- to re-run without running reset.sql separately. Preserves gmail_tokens.
-- Does NOT touch the proofs storage bucket — the seeded proof_url values
-- point at placehold.co, so no uploaded files are needed.
--
-- Mirrors migrations/0006_seed_demo_data.sql. Keep the two in sync if you
-- adjust the demo dataset.
--
-- Status spread: 3 RECONCILED · 3 PARTIAL · 1 UNVERIFIED · 2 PAID
-- · 1 AWAITING_TRANSFER · 2 PENDING. Five invoices settle cross-currency
-- to exercise the FX legs view on the Transactions tab.

begin;

truncate table public.audit_logs,
              public.gmail_verifications,
              public.proofs,
              public.transactions,
              public.invoices
  restart identity cascade;

insert into public.invoices (id, invoice_no, client_name, client_email, amount, currency, due_date, stripe_session_id, payment_link, status, payment_method, created_at) values
  ('00000000-0000-0000-0000-000000000101','INV-20260512-3041','Chiang Mai Ceramics','sales@cmceramics.co.th',18420.00,'SGD','2026-05-26','cs_test_3041','https://checkout.stripe.com/c/pay/cs_test_3041','PARTIAL','STRIPE','2026-05-12T09:14:00Z'),
  ('00000000-0000-0000-0000-000000000102','INV-20260506-1820','Kopi Roastery Co.','ops@kopiroastery.sg',4250.00,'SGD','2026-05-20','cs_test_1820','https://checkout.stripe.com/c/pay/cs_test_1820','RECONCILED','STRIPE','2026-05-06T03:22:00Z'),
  ('00000000-0000-0000-0000-000000000103','INV-20260510-7733','Saigon Linens','accounts@saigonlinens.vn',12500.00,'USD','2026-05-24','cs_test_7733','https://checkout.stripe.com/c/pay/cs_test_7733','RECONCILED','STRIPE','2026-05-10T11:48:00Z'),
  ('00000000-0000-0000-0000-000000000104','INV-20260515-4501','Bandung Robotics','finance@bandungrobotics.id',8900.00,'USD','2026-05-29','cs_test_4501','https://checkout.stripe.com/c/pay/cs_test_4501','PARTIAL','STRIPE','2026-05-15T07:05:00Z'),
  ('00000000-0000-0000-0000-000000000105','INV-20260517-9001','KL Spice Traders','info@klspice.my',3200.00,'MYR','2026-05-31','cs_test_9001','https://checkout.stripe.com/c/pay/cs_test_9001','UNVERIFIED','STRIPE','2026-05-17T14:30:00Z'),
  ('00000000-0000-0000-0000-000000000106','INV-20260520-2210','Manila Bay Optics','billing@manilabayoptics.ph',6700.00,'USD','2026-06-03','cs_test_2210','https://checkout.stripe.com/c/pay/cs_test_2210','PAID','STRIPE','2026-05-20T09:02:00Z'),
  ('00000000-0000-0000-0000-000000000107','INV-20260521-8654','Penang Print Works','orders@penangprint.my',2150.00,'MYR','2026-06-04','cs_test_8654','https://checkout.stripe.com/c/pay/cs_test_8654','PAID','STRIPE','2026-05-21T15:14:00Z'),
  ('00000000-0000-0000-0000-000000000108','INV-20260522-5523','Surabaya Plastics','finance@surabayaplas.id',9700.00,'USD','2026-06-05',null,null,'AWAITING_TRANSFER','BANK_TRANSFER','2026-05-22T10:48:00Z'),
  ('00000000-0000-0000-0000-000000000109','INV-20260524-4090','Bangkok Coffee Imports','pay@bkkcoffee.co.th',88000.00,'THB','2026-06-07','cs_test_4090','https://checkout.stripe.com/c/pay/cs_test_4090','PENDING','STRIPE','2026-05-24T01:12:00Z'),
  ('00000000-0000-0000-0000-000000000110','INV-20260523-7720','Jakarta Wire','billing@jakartawire.id',15400.00,'USD','2026-06-06','cs_test_7720','https://checkout.stripe.com/c/pay/cs_test_7720','PENDING','STRIPE','2026-05-23T18:05:00Z'),
  ('00000000-0000-0000-0000-000000000111','INV-20260503-6612','Singapore Marine Co','ar@singmarine.sg',22500.00,'SGD','2026-05-17','cs_test_6612','https://checkout.stripe.com/c/pay/cs_test_6612','RECONCILED','STRIPE','2026-05-03T08:38:00Z'),
  ('00000000-0000-0000-0000-000000000112','INV-20260519-3398','Davao Cacao Collective','coop@davaocacao.ph',4400.00,'USD','2026-06-02','cs_test_3398','https://checkout.stripe.com/c/pay/cs_test_3398','PARTIAL','STRIPE','2026-05-19T13:54:00Z');

insert into public.transactions (id, invoice_id, amount_received, currency_received, amount_converted, fx_rate, fx_timestamp, stripe_payment_intent, paid_at) values
  ('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000101',500842.40,'THB',18420.50,27.19,'2026-05-23T03:42:00Z','pi_test_3041','2026-05-23T03:42:00Z'),
  ('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000102',4250.00,'SGD',4250.00,1.0,'2026-05-09T16:11:00Z','pi_test_1820','2026-05-09T16:11:00Z'),
  ('00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000103',12500.00,'USD',12500.00,1.0,'2026-05-14T19:30:00Z','pi_test_7733','2026-05-14T19:30:00Z'),
  ('00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000104',140620000.00,'IDR',8895.10,15800.0,'2026-05-19T22:08:00Z','pi_test_4501','2026-05-19T22:08:00Z'),
  ('00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000105',2900.00,'MYR',2900.00,1.0,'2026-05-22T11:14:00Z','pi_test_9001','2026-05-22T11:14:00Z'),
  ('00000000-0000-0000-0000-000000000306','00000000-0000-0000-0000-000000000106',6700.00,'USD',6700.00,1.0,'2026-05-23T05:47:00Z','pi_test_2210','2026-05-23T05:47:00Z'),
  ('00000000-0000-0000-0000-000000000307','00000000-0000-0000-0000-000000000107',2150.00,'MYR',2150.00,1.0,'2026-05-23T20:22:00Z','pi_test_8654','2026-05-23T20:22:00Z'),
  ('00000000-0000-0000-0000-000000000311','00000000-0000-0000-0000-000000000111',16650.00,'USD',22500.00,0.74,'2026-05-09T07:18:00Z','pi_test_6612','2026-05-09T07:18:00Z'),
  ('00000000-0000-0000-0000-000000000312','00000000-0000-0000-0000-000000000112',246400.00,'PHP',4408.20,56.0,'2026-05-21T15:09:00Z','pi_test_3398','2026-05-21T15:09:00Z');

insert into public.proofs (id, invoice_id, proof_url, extracted_data, match_confidence, match_status, uploaded_at) values
  ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','https://placehold.co/640x480/16161d/edeef2/png?text=Bangkok+Bank+Receipt','{"amount":"500842.40","currency":"THB","sender":"ChiangMai Ceramics Co Ltd","date":"2026-05-23","reference":"INV-3041","amount_confidence":0.94,"currency_confidence":0.99,"sender_confidence":0.72,"date_confidence":1.00,"reference_confidence":0.81}'::jsonb,0.71,'PARTIAL','2026-05-23T04:08:00Z'),
  ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000102','https://placehold.co/640x480/16161d/edeef2/png?text=DBS+PayNow+Receipt','{"amount":"4250.00","currency":"SGD","sender":"Kopi Roastery Co Pte Ltd","date":"2026-05-09","reference":"INV-1820","amount_confidence":1.00,"currency_confidence":1.00,"sender_confidence":0.96,"date_confidence":1.00,"reference_confidence":0.95}'::jsonb,0.94,'RECONCILED','2026-05-09T16:32:00Z'),
  ('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000103','https://placehold.co/640x480/16161d/edeef2/png?text=Wise+USD+Receipt','{"amount":"12500.00","currency":"USD","sender":"Saigon Linens JSC","date":"2026-05-14","reference":"INV-7733","amount_confidence":1.00,"currency_confidence":1.00,"sender_confidence":0.91,"date_confidence":0.98,"reference_confidence":0.92}'::jsonb,0.91,'RECONCILED','2026-05-14T20:01:00Z'),
  ('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000104','https://placehold.co/640x480/16161d/edeef2/png?text=BCA+IDR+Receipt','{"amount":"140620000","currency":"IDR","sender":"PT Bandung Robotik","date":"2026-05-19","reference":"BR-INV4501","amount_confidence":0.97,"currency_confidence":0.99,"sender_confidence":0.58,"date_confidence":1.00,"reference_confidence":0.62}'::jsonb,0.68,'PARTIAL','2026-05-19T22:30:00Z'),
  ('00000000-0000-0000-0000-000000000205','00000000-0000-0000-0000-000000000105','https://placehold.co/640x480/16161d/edeef2/png?text=Maybank+FPX+Receipt','{"amount":"2900.00","currency":"MYR","sender":"Spice Importers Sdn Bhd","date":"2026-05-22","reference":"PAY-RND-77","amount_confidence":0.92,"currency_confidence":1.00,"sender_confidence":0.34,"date_confidence":1.00,"reference_confidence":0.18}'::jsonb,0.41,'UNVERIFIED','2026-05-22T11:42:00Z'),
  ('00000000-0000-0000-0000-000000000211','00000000-0000-0000-0000-000000000111','https://placehold.co/640x480/16161d/edeef2/png?text=HSBC+USD+Receipt','{"amount":"16650.00","currency":"USD","sender":"Singapore Marine Co Pte Ltd","date":"2026-05-09","reference":"INV-6612","amount_confidence":1.00,"currency_confidence":1.00,"sender_confidence":0.97,"date_confidence":1.00,"reference_confidence":0.99}'::jsonb,0.96,'RECONCILED','2026-05-09T07:55:00Z'),
  ('00000000-0000-0000-0000-000000000212','00000000-0000-0000-0000-000000000112','https://placehold.co/640x480/16161d/edeef2/png?text=BDO+PHP+Receipt','{"amount":"246400.00","currency":"PHP","sender":"Davao Cacao Coop","date":"2026-05-21","reference":"INV-3398","amount_confidence":0.95,"currency_confidence":0.99,"sender_confidence":0.66,"date_confidence":1.00,"reference_confidence":0.88}'::jsonb,0.74,'PARTIAL','2026-05-21T15:33:00Z');

insert into public.audit_logs (id, invoice_id, proof_id, status, confidence, proof_present, capped, signals, fx, reasons, summary, agent_version, created_at) values
  ('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201','PARTIAL',0.71,true,true,
    '{"amount_score":0.96,"date_score":1.00,"sender_score":0.58,"reference_score":0.42,"date_diff_days":0,"amount_diff_ratio":0.0014,"fx_drift_bps":4}'::jsonb,
    '{"invoice_currency":"SGD","received_currency":"THB","captured_rate":27.19,"resolved_rate":27.18,"rate_source":"stripe_balance_txn"}'::jsonb,
    '["FX drift within ±5bps tolerance","Sender name token_set_ratio 0.58 — variance flagged","Reference matched substring INV-3041 partially","Composite 0.71 — held for review"]'::jsonb,
    'PARTIAL at 0.71 — FX captured 27.19 vs resolved 27.18 (4bps drift) · sender variance · reference partial','matcher@v1','2026-05-23T04:15:00Z'),
  ('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000202','RECONCILED',0.94,true,false,
    '{"amount_score":1.00,"date_score":1.00,"sender_score":0.96,"reference_score":0.95,"date_diff_days":0,"amount_diff_ratio":0.0}'::jsonb,
    '{"invoice_currency":"SGD","received_currency":"SGD","captured_rate":1.0,"resolved_rate":1.0,"rate_source":"same_currency"}'::jsonb,
    '["Amount exact match","Sender name strong match (token_set_ratio 0.96)","Reference matched INV-1820","Composite 0.94 ≥ 0.85 threshold — auto-RECONCILED"]'::jsonb,
    'RECONCILED at 0.94 — all signals aligned, same-currency settlement.','matcher@v1','2026-05-09T16:45:00Z'),
  ('00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000203','RECONCILED',0.91,true,false,
    '{"amount_score":1.00,"date_score":0.98,"sender_score":0.91,"reference_score":0.92,"date_diff_days":0,"amount_diff_ratio":0.0}'::jsonb,
    '{"invoice_currency":"USD","received_currency":"USD","captured_rate":1.0,"resolved_rate":1.0,"rate_source":"same_currency"}'::jsonb,
    '["Same-currency settlement","Sender + reference both above 0.9","Composite 0.91 ≥ 0.85 — auto-RECONCILED"]'::jsonb,
    'RECONCILED at 0.91 — USD same-currency, reference and sender matched.','matcher@v1','2026-05-14T20:18:00Z'),
  ('00000000-0000-0000-0000-000000000404','00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000204','PARTIAL',0.68,true,true,
    '{"amount_score":0.97,"date_score":1.00,"sender_score":0.58,"reference_score":0.62,"date_diff_days":0,"amount_diff_ratio":0.0006}'::jsonb,
    '{"invoice_currency":"USD","received_currency":"IDR","captured_rate":15800.0,"resolved_rate":15820.0,"rate_source":"frankfurter","fx_drift_bps":13}'::jsonb,
    '["Cross-currency USD→IDR, FX captured 15800 vs Frankfurter 15820 (13bps)","Sender variance: PT Bandung Robotik vs Bandung Robotics","Composite 0.68 — held for review"]'::jsonb,
    'PARTIAL at 0.68 — FX drift acceptable, sender variance flagged.','matcher@v1','2026-05-19T22:46:00Z'),
  ('00000000-0000-0000-0000-000000000405','00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000205','UNVERIFIED',0.41,true,false,
    '{"amount_score":0.91,"date_score":1.00,"sender_score":0.34,"reference_score":0.18}'::jsonb,
    '{"invoice_currency":"MYR","received_currency":"MYR","captured_rate":1.0,"resolved_rate":1.0,"rate_source":"same_currency"}'::jsonb,
    '["Amount short by 300 MYR (paid 2900 vs invoice 3200)","Sender Spice Importers Sdn Bhd does not match KL Spice Traders","Reference PAY-RND-77 does not contain invoice number","Composite 0.41 < 0.60 — REJECTED"]'::jsonb,
    'UNVERIFIED at 0.41 — multiple signal failures.','matcher@v1','2026-05-22T11:54:00Z'),
  ('00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-000000000211','RECONCILED',0.96,true,false,
    '{"amount_score":1.00,"date_score":1.00,"sender_score":0.97,"reference_score":0.99,"date_diff_days":0,"amount_diff_ratio":0.0}'::jsonb,
    '{"invoice_currency":"SGD","received_currency":"USD","captured_rate":0.74,"resolved_rate":0.74,"rate_source":"stripe_balance_txn"}'::jsonb,
    '["Cross-currency SGD→USD captured at 0.74 matches Frankfurter","All signals ≥ 0.9","Composite 0.96 — RECONCILED"]'::jsonb,
    'RECONCILED at 0.96 — SGD invoice settled in USD, all signals high.','matcher@v1','2026-05-09T08:10:00Z'),
  ('00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-000000000112','00000000-0000-0000-0000-000000000212','PARTIAL',0.74,true,true,
    '{"amount_score":0.95,"date_score":1.00,"sender_score":0.66,"reference_score":0.88}'::jsonb,
    '{"invoice_currency":"USD","received_currency":"PHP","captured_rate":56.0,"resolved_rate":56.1,"rate_source":"stripe_balance_txn","fx_drift_bps":18}'::jsonb,
    '["USD→PHP FX 18bps drift","Sender Davao Cacao Coop vs Davao Cacao Collective","Reference INV-3398 matched"]'::jsonb,
    'PARTIAL at 0.74 — FX in tolerance, sender name truncated.','matcher@v1','2026-05-21T15:48:00Z');

insert into public.gmail_verifications (id, invoice_id, gmail_message_id, checks, status, created_transaction_id, reason, searched_at) values
  ('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000108',null,
    '{"searched_subject":"You''ve received a transfer","window_minutes":4320}'::jsonb,
    'NOT_FOUND', null, 'No DBS notification email matching invoice number INV-20260522-5523 yet','2026-05-24T02:14:00Z');

commit;
