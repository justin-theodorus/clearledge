import Link from "next/link";
import { Plus, Activity } from "lucide-react";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { requireAdmin } from "@/app/lib/server/supabaseAuth";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { ConfBar, Money, StatCard } from "@/app/components/ui/primitives";
import { formatDate } from "@/app/lib/invoice";
import { SettlementChart, type StackedDay } from "./components/dashboard/SettlementChart";
import { AgentActivityFeed, type FeedEntry } from "./components/dashboard/AgentActivityFeed";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  invoice_no: string;
  client_name: string;
  client_email: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  created_at: string;
  due_date: string | null;
};

type AuditRow = {
  id: string;
  invoice_id: string;
  status: InvoiceStatus;
  confidence: number;
  summary: string;
  created_at: string;
  invoices: { invoice_no: string; client_name: string } | null;
};


async function fetchFxRate(from: string, to: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.rates?.[to] ?? null;
  } catch {
    return null;
  }
}

async function fetchFxHistory(from: string, to: string): Promise<number[]> {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 13);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const res = await fetch(`https://api.frankfurter.app/${startStr}..${endStr}?from=${from}&to=${to}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    const rates = json.rates as Record<string, Record<string, number>>;
    return Object.keys(rates).sort().map((date) => rates[date][to]);
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  await requireAdmin();
  const supabase = getSupabaseAdmin();

  const [invoicesRes, auditRes, txnRes, usdMyr, sgdMyr, usdMyrHistory, sgdMyrHistory] = await Promise.all([
    supabase
      .from("invoices")
      .select("id,invoice_no,client_name,client_email,amount,currency,status,created_at,due_date")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("audit_logs")
      .select("id,invoice_id,status,confidence,summary,created_at,invoices(invoice_no,client_name)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("transactions")
      .select("amount_received,currency_received,fx_rate,paid_at,invoice_id")
      .order("paid_at", { ascending: false })
      .limit(200),
    fetchFxRate("USD", "MYR"),
    fetchFxRate("SGD", "MYR"),
    fetchFxHistory("USD", "MYR"),
    fetchFxHistory("SGD", "MYR"),
  ]);

  const invoices = (invoicesRes.data ?? []) as InvoiceRow[];
  const audits = (auditRes.data ?? []) as unknown as AuditRow[];
  void txnRes;

  /* ─── Stats ─── */
  const todayKey = new Date().toISOString().slice(0, 10);
  const reconciledToday = invoices.filter(
    (i) => i.status === "RECONCILED" && i.created_at.slice(0, 10) >= todayKey,
  ).length;

  const pendingProofs = invoices.filter(
    (i) => i.status === "AWAITING_TRANSFER" || i.status === "PAID",
  ).length;


  /* ─── 30-day stacked chart ─── */
  const byDay = new Map<string, StackedDay>();
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, reconciled: 0, partial: 0, unverified: 0 });
  }
  for (const i of invoices) {
    const k = i.created_at.slice(0, 10);
    const row = byDay.get(k);
    if (!row) continue;
    const amt = Number(i.amount);
    if (i.status === "RECONCILED") row.reconciled += amt;
    else if (i.status === "PARTIAL") row.partial += amt;
    else if (i.status === "UNVERIFIED") row.unverified += amt;
  }
  const chart = Array.from(byDay.values());

  /* ─── Sparklines ─── */
  const trendColor = (data: number[]) => {
    if (data.length < 2) return "var(--cl-primary-400)";
    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    return last >= prev ? "#22c55e" : "#ef4444";
  };
  const dailyChange = (data: number[]): number | undefined => {
    if (data.length < 2) return undefined;
    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    if (!prev) return undefined;
    return ((last - prev) / prev) * 100;
  };
  const nowMs = Date.now();
  const sparkCumulative = (predicate: (i: InvoiceRow) => boolean): number[] => {
    const arr = Array(14).fill(0);
    for (const inv of invoices) {
      if (!predicate(inv)) continue;
      const days = Math.floor((nowMs - new Date(inv.created_at).getTime()) / 86400000);
      if (days >= 0 && days < 14) arr[13 - days] += 1;
    }
    for (let i = 1; i < arr.length; i++) arr[i] += arr[i - 1];
    return arr;
  };

  const feed: FeedEntry[] = audits.map((a) => ({
    id: a.id,
    invoiceId: a.invoice_id,
    invoiceNo: a.invoices?.invoice_no ?? a.invoice_id.slice(0, 8),
    client: a.invoices?.client_name ?? "—",
    status: a.status,
    confidence: Number(a.confidence),
    summary: a.summary,
    createdAt: a.created_at,
  }));

  /* ─── Recent activity (7 rows) ─── */
  const recent = invoices.slice(0, 7);

  /* ─── Confidence map per invoice (for table) ─── */
  const confByInvoice = new Map<string, number>();
  for (const a of audits) {
    if (!confByInvoice.has(a.invoice_id)) {
      confByInvoice.set(a.invoice_id, Number(a.confidence));
    }
  }

  return (
    <>
      <div className="cl-page-head">
        <div className="cl-page-title">
          <h1 className="cl-h1">Good afternoon</h1>
          <p>Treasury overview · {new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date())}</p>
        </div>
        <div className="cl-page-actions">
          <Link href="/invoices/new" className="cl-btn is-primary">
            <Plus size={14} />
            New invoice
          </Link>
        </div>
      </div>

      <div className="cl-stat-grid">
        <StatCard
          label="USD / MYR"
          value={usdMyr ? usdMyr.toFixed(4) : "—"}
          deltaLabel="real-time rate"
          spark={usdMyrHistory}
          sparkColor={trendColor(usdMyrHistory)}
          change={dailyChange(usdMyrHistory)}
        />
        <StatCard
          label="Reconciled today"
          value={String(reconciledToday)}
          deltaLabel={`of ${invoices.length} total`}
          spark={sparkCumulative((i: InvoiceRow) => i.status === "RECONCILED")}
          sparkColor={trendColor(sparkCumulative((i: InvoiceRow) => i.status === "RECONCILED"))}
        />
        <StatCard
          label="Pending proofs"
          value={String(pendingProofs)}
          deltaLabel="awaiting upload"
          spark={sparkCumulative((i: InvoiceRow) => i.status === "AWAITING_TRANSFER" || i.status === "PAID")}
          sparkColor={trendColor(sparkCumulative((i: InvoiceRow) => i.status === "AWAITING_TRANSFER" || i.status === "PAID"))}
        />
        <StatCard
          label="SGD / MYR"
          value={sgdMyr ? sgdMyr.toFixed(4) : "—"}
          deltaLabel="real-time rate"
          spark={sgdMyrHistory}
          sparkColor={trendColor(sgdMyrHistory)}
          change={dailyChange(sgdMyrHistory)}
        />
      </div>

      <div className="cl-grid-2" style={{ marginBottom: 22 }}>
        <div className="cl-card">
          <div className="cl-card-head">
            <h2>
              <Activity size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Settlement volume · last 30 days
            </h2>
            <span className="cl-tag">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--cl-emerald)" }} /> reconciled
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--cl-amber)", marginLeft: 8 }} /> partial
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--cl-rose)", marginLeft: 8 }} /> unverified
            </span>
          </div>
          <div className="cl-card-pad">
            <SettlementChart data={chart} />
          </div>
        </div>

        <div className="cl-card">
          <div className="cl-card-head">
            <h2>Live agent activity</h2>
            <span className="cl-tag" style={{ color: "var(--cl-emerald)" }}>
              <span className="cl-pill-dot" style={{ background: "var(--cl-emerald)" }} /> live
            </span>
          </div>
          <AgentActivityFeed initial={feed} />
        </div>
      </div>

      <div className="cl-card">
        <div className="cl-card-head">
          <h2>Recent activity</h2>
          <Link href="/invoices" className="cl-link" style={{ fontSize: 12 }}>
            View all →
          </Link>
        </div>
        <div className="cl-table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table className="cl-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ width: 140 }}>Confidence</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={6} className="cl-empty">No invoices yet.</td></tr>
              ) : recent.map((i) => {
                const conf = confByInvoice.get(i.id);
                return (
                  <tr key={i.id} style={{ cursor: "pointer" }}>
                    <td>
                      <Link href={`/invoices/${i.id}`} className="cl-mono" style={{ color: "var(--cl-fg)" }}>
                        {i.invoice_no}
                      </Link>
                    </td>
                    <td>
                      <div className="cl-stack">
                        <span>{i.client_name}</span>
                        <span className="cl-subtle" style={{ fontSize: 11 }}>{i.client_email}</span>
                      </div>
                    </td>
                    <td className="is-num"><Money amount={Number(i.amount)} currency={i.currency} /></td>
                    <td><StatusBadge status={i.status} /></td>
                    <td>{conf !== undefined ? <ConfBar value={conf} /> : <span className="cl-faint">—</span>}</td>
                    <td className="cl-subtle">{formatDate(i.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
