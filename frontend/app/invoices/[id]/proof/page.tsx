import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { formatMoney } from "@/app/lib/invoice";
import { Money } from "@/app/components/ui/primitives";
import { ProofUploadForm } from "@/app/components/ProofUploadForm";

export default async function ProofUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  const { paid } = await searchParams;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("invoices")
    .select("id,invoice_no,amount,currency,status,payment_method,client_name")
    .eq("id", id).maybeSingle();
  if (!data) notFound();

  const stillPending = data.status === "PENDING" || data.status === "AWAITING_TRANSFER";
  const isBankTransfer = data.payment_method === "BANK_TRANSFER";

  return (
    <div className="cl-pay-wrap">
      <div className="cl-pay-card" style={{ width: 560 }}>
        <div className="cl-row-between" style={{ padding: "18px 22px", borderBottom: "1px solid var(--cl-border)" }}>
          <div className="cl-row-gap">
            <span className="cl-brand-mark">CL</span>
            <div className="cl-stack" style={{ lineHeight: 1.2 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{data.client_name}</span>
              <span className="cl-subtle" style={{ fontSize: 11 }}>Invoice <span className="cl-mono">{data.invoice_no}</span></span>
            </div>
          </div>
          <div className="cl-mono" style={{ fontSize: 13, color: "var(--cl-fg-muted)" }}>
            <Money amount={Number(data.amount)} currency={data.currency} />
          </div>
        </div>

        <div style={{ padding: "22px" }}>
          <h1 className="cl-h1" style={{ fontSize: 18, marginBottom: 6 }}>Upload payment proof</h1>
          <p className="cl-subtle" style={{ fontSize: 13, marginBottom: 18 }}>
            {formatMoney(Number(data.amount), data.currency)}
            {isBankTransfer
              ? " — required so we can match it to your bank notification email."
              : " — optional, but helps us reconcile faster."}
          </p>

          {paid === "1" && stillPending ? (
            <div className="cl-pill is-amber" style={{ marginBottom: 16 }}>
              Stripe confirmed your payment — still finalizing.
            </div>
          ) : null}
          {paid === "1" && !stillPending ? (
            <div className="cl-pill is-emerald" style={{ marginBottom: 16 }}>Payment received.</div>
          ) : null}

          <ProofUploadForm invoiceId={data.id} allowSkip={!isBankTransfer} />
        </div>
      </div>
    </div>
  );
}
