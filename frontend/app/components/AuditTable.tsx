import Link from "next/link";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { formatDate } from "@/app/lib/invoice";

export type AuditTableRow = {
  id: string;
  invoice_id: string;
  status: InvoiceStatus;
  confidence: number;
  summary: string;
  created_at: string;
  invoices: { invoice_no: string; client_name: string } | null;
};

export function AuditTable({ entries }: { entries: AuditTableRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <Th>When</Th>
            <Th>Invoice</Th>
            <Th>Client</Th>
            <Th>Status</Th>
            <Th>Confidence</Th>
            <Th>Summary</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {entries.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400"
              >
                No audit entries yet. Run the Matcher agent against an invoice to populate this log.
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr
                key={entry.id}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {formatDate(entry.created_at)}
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  <Link
                    href={`/invoices/${entry.invoice_id}`}
                    className="text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {entry.invoices?.invoice_no ?? entry.invoice_id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                  {entry.invoices?.client_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge status={entry.status} />
                </td>
                <td className="px-4 py-3 text-sm text-zinc-700 tabular-nums dark:text-zinc-300">
                  {Number(entry.confidence).toFixed(3)}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {entry.summary}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
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
