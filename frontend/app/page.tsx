import Link from "next/link";

export default function DashboardPage() {
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
          <span
            aria-current="page"
            className="border-b-2 border-zinc-900 px-1 pb-3 text-sm font-medium text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
          >
            Invoices
          </span>
          <span
            aria-disabled="true"
            title="Coming soon"
            className="flex cursor-not-allowed items-center gap-2 border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-zinc-400 dark:text-zinc-600"
          >
            Audit
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              Coming soon
            </span>
          </span>
        </nav>
      </div>

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
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  Invoice #
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  Client
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
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
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
