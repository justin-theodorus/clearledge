import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { formatDate, formatMoney } from "@/app/lib/invoice";
import { CopyLinkButton } from "./CopyLinkButton";

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
  created_at: string;
};

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  const { paid } = await searchParams;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id,invoice_no,client_name,client_email,amount,currency,due_date,status,stripe_session_id,payment_link,created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[invoice detail] fetch failed", error);
  }
  if (!data) notFound();
  const invoice = data as InvoiceRow;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Invoice
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {invoice.invoice_no}
            <StatusBadge status={invoice.status} />
          </h1>
        </div>
        <Link
          href="/invoices/new"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          + New invoice
        </Link>
      </div>

      {paid === "1" ? (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Stripe reported payment success. Reconciliation is pending — the
          webhook will flip status to PAID once wired up.
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Field label="Client" value={invoice.client_name} />
        <Field
          label="Amount"
          value={formatMoney(Number(invoice.amount), invoice.currency)}
        />
        <Field
          label="Due"
          value={invoice.due_date ? formatDate(invoice.due_date) : "—"}
        />
        <Field label="Email" value={invoice.client_email} />
        <Field label="Currency" value={invoice.currency} />
        <Field label="Created" value={formatDate(invoice.created_at)} />
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Payment link</h2>
        {invoice.payment_link ? (
          <>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Stripe Checkout session for this invoice.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-zinc-100 px-2 py-1.5 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {invoice.payment_link}
              </code>
              <CopyLinkButton value={invoice.payment_link} />
              <a
                href={invoice.payment_link}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
              >
                Open
              </a>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            No payment link on file yet.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}
