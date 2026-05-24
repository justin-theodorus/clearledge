import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { requireAdmin } from "@/app/lib/server/supabaseAuth";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { AuditTrail, AuditEntry } from "@/app/components/AuditTrail";
import { AuditWatcher } from "@/app/components/AuditWatcher";
import { RingMeter, Money } from "@/app/components/ui/primitives";
import { LivePipeline } from "@/app/components/Pipeline";
import { pipelineFromAudit } from "@/app/components/pipelineFromAudit";
import { formatDate, formatMoney } from "@/app/lib/invoice";
import { CopyLinkButton } from "./CopyLinkButton";
import { InvoiceTabs } from "./InvoiceTabs";

type InvoiceRow = {
  id: string;
  invoice_no: string;
  client_name: string;
  client_email: string;
  amount: number;
  currency: string;
  due_date: string | null;
  status: InvoiceStatus;
  stripe_session_id: string | null;
  payment_link: string | null;
  payment_method: "STRIPE" | "BANK_TRANSFER";
  created_at: string;
};

type TxnRow = {
  amount_received: number;
  currency_received: string;
  amount_converted: number | null;
  fx_rate: number | null;
  fx_timestamp: string | null;
  stripe_payment_intent: string | null;
  paid_at: string;
};

type ProofRow = {
  id: string;
  proof_url: string;
  extracted_data: Record<string, unknown> | null;
  match_confidence: number | null;
  match_status: string | null;
  uploaded_at: string;
};

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; tab?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { paid, tab } = await searchParams;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("invoices")
    .select("id,invoice_no,client_name,client_email,amount,currency,due_date,status,stripe_session_id,payment_link,payment_method,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[invoice detail] fetch failed", error);
  if (!data) notFound();
  const invoice = data as InvoiceRow;

  const [proofRes, txnRes, auditRes] = await Promise.all([
    supabase
      .from("proofs")
      .select("id,proof_url,extracted_data,match_confidence,match_status,uploaded_at")
      .eq("invoice_id", id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("amount_received,currency_received,amount_converted,fx_rate,fx_timestamp,stripe_payment_intent,paid_at")
      .eq("invoice_id", id)
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("audit_logs")
      .select("id,status,confidence,summary,reasons,capped,created_at,signals")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const proof = (proofRes.data ?? null) as ProofRow | null;
  const txn = (txnRes.data ?? null) as TxnRow | null;
  const auditEntries = (auditRes.data ?? []) as (AuditEntry & { signals?: Record<string, unknown> })[];
  const latestAudit = auditEntries[0] ?? null;

  const pipelineStages = pipelineFromAudit(latestAudit, !!proof);
  const confidence = latestAudit ? Number(latestAudit.confidence) : 0;

  return (
    <>
      <AuditWatcher invoiceId={invoice.id} initialCount={auditEntries.length} />
      <div className="cl-row-between" style={{ marginBottom: 16 }}>
        <Link href="/invoices" className="cl-btn is-ghost is-sm">
          <ChevronLeft size={14} /> Back to invoices
        </Link>
        <Link href={`/invoices/${invoice.id}/pay`} target="_blank" className="cl-btn is-sm">
          <ExternalLink size={12} /> View pay page
        </Link>
      </div>

      <div className="cl-page-head">
        <div className="cl-page-title">
          <div className="cl-row-gap" style={{ marginBottom: 4 }}>
            <span className="cl-mono cl-h1" style={{ fontSize: 22 }}>{invoice.invoice_no}</span>
            <StatusBadge status={invoice.status} large />
          </div>
          <p>{invoice.client_name} · {invoice.client_email}</p>
        </div>
      </div>

      {paid === "1" ? (
        <div className="cl-pill is-emerald" style={{ marginBottom: 16 }}>
          {invoice.status === "PENDING" ? "Payment confirmed — reconciling…" : "Payment received."}
        </div>
      ) : null}

      {/* Summary strip */}
      <div
        className="cl-card cl-card-pad"
        style={{ marginBottom: 22, display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 24, alignItems: "center" }}
      >
        <div>
          <div className="cl-h3" style={{ marginBottom: 6 }}>Invoiced</div>
          <div className="cl-mono" style={{ fontSize: 22, color: "var(--cl-fg)" }}>
            <Money amount={Number(invoice.amount)} currency={invoice.currency} />
          </div>
          <div className="cl-subtle" style={{ fontSize: 12, marginTop: 4 }}>
            Due {invoice.due_date ? formatDate(invoice.due_date) : "—"}
          </div>
        </div>
        <div className="cl-row-gap">
          <RingMeter value={confidence} size={64} stroke={6} />
          <div>
            <div className="cl-h3" style={{ marginBottom: 4 }}>Match confidence</div>
            <div className="cl-row-gap" style={{ gap: 8, flexWrap: "wrap" }}>
              {latestAudit ? (
                <StatusBadge status={latestAudit.status} />
              ) : null}
              <span className="cl-subtle" style={{ fontSize: 12 }}>
                {latestAudit ? auditHeadline(latestAudit.status) : "Pipeline not yet run"}
              </span>
              {latestAudit?.capped ? (
                <span className="cl-tag" style={{ color: "var(--cl-amber)" }}>Capped</span>
              ) : null}
            </div>
          </div>
        </div>
        <div>
          <div className="cl-h3" style={{ marginBottom: 6 }}>Agent pipeline</div>
          <LivePipeline
            target={pipelineStages}
            runKey={latestAudit?.id ?? "empty"}
            compact
          />
        </div>
      </div>

      <InvoiceTabs
        defaultTab={tab ?? "overview"}
        invoice={invoice}
        proof={proof}
        txn={txn}
        latestAudit={latestAudit}
        auditCount={auditEntries.length}
        copyLinkButton={
          invoice.payment_link ? <CopyLinkButton value={invoice.payment_link} /> : null
        }
        auditTrail={
          <AuditTrail
            invoiceId={invoice.id}
            initialEntries={auditEntries}
          />
        }
      />
    </>
  );
}

function auditHeadline(status: InvoiceStatus): string {
  if (status === "RECONCILED") return "Auto-reconciled, all signals aligned";
  if (status === "PARTIAL") return "Held for review";
  if (status === "UNVERIFIED") return "Match rejected";
  if (status === "ERROR") return "Pipeline error";
  return "Awaiting reconciliation";
}

export { formatMoney };
