import Link from "next/link";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { AuditTable, AuditTableRow } from "@/app/components/AuditTable";
import { formatDate, formatMoney } from "@/app/lib/invoice";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  invoice_no: string;
  client_name: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  created_at: string;
};

type Tab = "invoices" | "audit";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab: Tab = tab === "audit" ? "audit" : "invoices";
  const supabase = getSupabaseAdmin();

  let invoices: InvoiceRow[] = [];
  let auditEntries: AuditTableRow[] = [];

  if (activeTab === "invoices") {
    const { data, error } = await supabase
      .from("invoices")
      .select("id,invoice_no,client_name,amount,currency,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) console.error("[dashboard] invoices fetch failed", error);
    invoices = (data ?? []) as InvoiceRow[];
  } else {
    const { data, error } = await supabase
      .from("audit_logs")
      .select(
        "id,invoice_id,status,confidence,summary,created_at,invoices(invoice_no,client_name)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) console.error("[dashboard] audit fetch failed", error);
    auditEntries = (data ?? []) as unknown as AuditTableRow[];
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Track invoices, payments, and reconciliation status.
        </p>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          <TabLink href="/?tab=invoices" active={activeTab === "invoices"}>
            Invoices
          </TabLink>
          <TabLink href="/?tab=audit" active={activeTab === "audit"}>
            Audit
          </TabLink>
        </nav>
      </div>

      {activeTab === "invoices" ? (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">All invoices</h2>
            <Link
              href="/invoices/new"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
            >
              Create invoice
            </Link>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <Th>Invoice #</Th>
                  <Th>Client</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {invoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400"
                    >
                      No invoices yet.{" "}
                      <Link
                        href="/invoices/new"
                        className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-50"
                      >
                        Create your first invoice
                      </Link>
                      .
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <td className="px-4 py-3 text-sm font-medium">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="text-zinc-900 hover:underline dark:text-zinc-50"
                        >
                          {inv.invoice_no}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                        {inv.client_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                        {formatMoney(Number(inv.amount), inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                        {formatDate(inv.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Audit trail</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Append-only log of every Matcher decision.
            </p>
          </div>
          <AuditTable entries={auditEntries} />
        </section>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const base =
    "border-b-2 px-1 pb-3 text-sm font-medium transition-colors";
  const cls = active
    ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
    : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50";
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`${base} ${cls}`}>
      {children}
    </Link>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
    >
      {children}
    </th>
  );
}
