import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { fetchFxRate } from "@/app/lib/server/fx";
import { REGIONS, RegionCode } from "@/app/lib/regions";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { Money } from "@/app/components/ui/primitives";
import { formatDate } from "@/app/lib/invoice";
import { RegionPicker } from "./RegionPicker";
import { BankTransferPanel, BankTransferQuote } from "./BankTransferPanel";

type InvoiceRow = {
  id: string;
  invoice_no: string;
  client_name: string;
  amount: number;
  currency: string;
  due_date: string | null;
  status: InvoiceStatus;
  payment_method: "STRIPE" | "BANK_TRANSFER";
};

export default async function InvoicePayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("invoices")
    .select("id,invoice_no,client_name,amount,currency,due_date,status,payment_method")
    .eq("id", id).maybeSingle();
  if (!data) notFound();
  const invoice = data as InvoiceRow;

  let quotes: BankTransferQuote[] = [];
  if (invoice.payment_method === "BANK_TRANSFER") {
    const today = new Date();
    const invoiceCurrency = invoice.currency.toUpperCase();
    const regionCodes = Object.keys(REGIONS) as RegionCode[];
    quotes = await Promise.all(regionCodes.map(async (code) => {
      const r = REGIONS[code];
      const target = r.currency.toUpperCase();
      if (target === invoiceCurrency) {
        return { region: code, label: r.label, currency: target, amount: Number(invoice.amount), rate: 1, rateDate: today.toISOString().slice(0, 10) };
      }
      const fx = await fetchFxRate(invoiceCurrency, target, today);
      if (!fx) return { region: code, label: r.label, currency: target, amount: null, rate: null, rateDate: null };
      return { region: code, label: r.label, currency: target, amount: Number((Number(invoice.amount) * fx.rate).toFixed(2)), rate: fx.rate, rateDate: fx.date };
    }));
  }

  return (
    <div className="cl-pay-wrap">
      <div className="cl-pay-card">
        {/* Brand bar */}
        <div className="cl-row-between" style={{ padding: "18px 22px", borderBottom: "1px solid var(--cl-border)" }}>
          <div className="cl-row-gap">
            <span className="cl-brand-mark">CL</span>
            <div className="cl-stack" style={{ lineHeight: 1.2 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Acme Trading Pte Ltd</span>
              <span className="cl-subtle" style={{ fontSize: 11 }}>via ClearLedge · secured</span>
            </div>
          </div>
          <Link href={`/invoices/${invoice.id}/proof`} className="cl-btn is-sm">
            <FileText size={12} /> Already paid?
          </Link>
        </div>

        {/* Amount due */}
        <div style={{ padding: "26px 22px 16px", textAlign: "center" }}>
          <div className="cl-h3" style={{ marginBottom: 6, justifyContent: "center" }}>Amount due</div>
          <div className="cl-mono" style={{ fontSize: 36, color: "var(--cl-fg)", fontWeight: 600 }}>
            <Money amount={Number(invoice.amount)} currency={invoice.currency} />
          </div>
          <div className="cl-row-gap" style={{ justifyContent: "center", marginTop: 10 }}>
            <StatusBadge status={invoice.status} />
            <span className="cl-subtle" style={{ fontSize: 12 }}>
              Invoice <span className="cl-mono">{invoice.invoice_no}</span>
              {invoice.due_date ? ` · due ${formatDate(invoice.due_date)}` : ""}
            </span>
          </div>
        </div>

        {/* Payment */}
        <div style={{ padding: "12px 22px 22px" }}>
          {invoice.payment_method === "BANK_TRANSFER" ? (
            <BankTransferPanel
              invoiceId={invoice.id}
              invoiceNo={invoice.invoice_no}
              invoiceAmount={Number(invoice.amount)}
              invoiceCurrency={invoice.currency}
              accountNumber={process.env.SME_ACCOUNT_NUMBER ?? ""}
              bankName={process.env.SME_BANK_NAME ?? "DBS Bank"}
              accountCurrency={process.env.SME_ACCOUNT_CURRENCY ?? "SGD"}
              quotes={quotes}
            />
          ) : (
            <RegionPicker invoiceId={invoice.id} defaultRegion="SG" />
          )}
        </div>
      </div>
    </div>
  );
}
