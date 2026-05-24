import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { formatDate, formatMoney } from "@/app/lib/invoice";
import { RegionPicker } from "./RegionPicker";

type InvoiceRow = {
  id: string;
  invoice_no: string;
  client_name: string;
  amount: number;
  currency: string;
  due_date: string | null;
  status: InvoiceStatus;
};

export default async function InvoicePayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("invoices")
    .select("id,invoice_no,client_name,amount,currency,due_date,status")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const invoice = data as InvoiceRow;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Pay invoice
        </p>
        <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight">
          {invoice.invoice_no}
          <StatusBadge status={invoice.status} />
        </h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Billed to
          </p>
          <p className="mt-1 font-medium">{invoice.client_name}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Amount
          </p>
          <p className="mt-1 font-medium">
            {formatMoney(Number(invoice.amount), invoice.currency)}
          </p>
        </div>
        {invoice.due_date ? (
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Due
            </p>
            <p className="mt-1 font-medium">{formatDate(invoice.due_date)}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <RegionPicker invoiceId={invoice.id} defaultRegion="SG" />
        <p className="mt-4 text-[11px] text-zinc-500 dark:text-zinc-400">
          Cross-currency totals are converted at today&apos;s mid-market rate
          before checkout; Stripe&apos;s settlement rate is recorded on payment.
        </p>
      </div>
    </div>
  );
}
