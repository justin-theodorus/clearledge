import Link from "next/link";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { ConfPill } from "@/app/components/ui/primitives";
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
    <div className="cl-table-wrap">
      <table className="cl-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Invoice</th>
            <th>Client</th>
            <th>Status</th>
            <th>Confidence</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr><td colSpan={6} className="cl-empty">No audit entries yet.</td></tr>
          ) : entries.map((entry) => (
            <tr key={entry.id}>
              <td className="cl-subtle">{formatDate(entry.created_at)}</td>
              <td>
                <Link
                  href={`/invoices/${entry.invoice_id}`}
                  className="cl-mono"
                  style={{ color: "var(--cl-fg)", textDecoration: "none" }}
                >
                  {entry.invoices?.invoice_no ?? entry.invoice_id.slice(0, 8)}
                </Link>
              </td>
              <td>{entry.invoices?.client_name ?? "—"}</td>
              <td><StatusBadge status={entry.status} /></td>
              <td><ConfPill value={Number(entry.confidence)} /></td>
              <td className="cl-muted" style={{ whiteSpace: "normal", maxWidth: 380 }}>{entry.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
