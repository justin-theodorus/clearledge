import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { formatMoney } from "@/app/lib/invoice";

export default async function PaymentDonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("invoices")
    .select("invoice_no,amount,currency,client_name,payment_method")
    .eq("id", id).maybeSingle();
  if (!data) notFound();

  const isBankTransfer = data.payment_method === "BANK_TRANSFER";

  return (
    <div className="cl-pay-wrap">
      <div className="cl-pay-card" style={{ width: 480 }}>
        <div style={{ padding: "40px 28px", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "color-mix(in oklab, var(--cl-emerald-500, #10b981) 14%, transparent)",
              color: "var(--cl-emerald-500, #10b981)",
              marginBottom: 18,
            }}
          >
            <CheckCircle2 size={32} />
          </div>
          <h1 className="cl-h1" style={{ fontSize: 22, marginBottom: 8 }}>
            All done
          </h1>
          <p className="cl-subtle" style={{ fontSize: 13.5, marginBottom: 22, lineHeight: 1.5 }}>
            {isBankTransfer
              ? `Thanks — we received your proof of transfer for ${formatMoney(Number(data.amount), data.currency)}. ${data.client_name} will reconcile it shortly and follow up by email if anything is missing.`
              : `Thanks — payment of ${formatMoney(Number(data.amount), data.currency)} is complete. ${data.client_name} will email a receipt shortly.`}
          </p>
          <div
            className="cl-mono"
            style={{ fontSize: 12, color: "var(--cl-fg-muted)" }}
          >
            Invoice {data.invoice_no}
          </div>
          <p className="cl-subtle" style={{ fontSize: 12, marginTop: 26 }}>
            You can safely close this window.
          </p>
        </div>
      </div>
    </div>
  );
}
