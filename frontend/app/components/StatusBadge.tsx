export type InvoiceStatus =
  | "PENDING"
  | "PAID"
  | "RECONCILED"
  | "PARTIAL"
  | "UNVERIFIED";

const styles: Record<InvoiceStatus, string> = {
  PENDING:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  PAID: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  RECONCILED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  PARTIAL:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  UNVERIFIED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}
