import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { formatMoney } from "@/app/lib/invoice";
import { ProofUploadForm } from "@/app/components/ProofUploadForm";

export default async function ProofUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  const { paid } = await searchParams;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("invoices")
    .select("id,invoice_no,amount,currency,status")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const stillPending = data.status === "PENDING";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Invoice {data.invoice_no}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Upload payment proof
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {formatMoney(Number(data.amount), data.currency)} — optional, but helps
        us reconcile faster.
      </p>

      {paid === "1" && stillPending ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Stripe confirmed your payment — we&apos;re still finalizing the ledger
          entry. You can upload now; it&apos;ll be matched once reconciliation
          completes.
        </div>
      ) : null}
      {paid === "1" && !stillPending ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Payment received. Upload a screenshot or PDF of your bank transfer
          confirmation to help us match it.
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <ProofUploadForm invoiceId={data.id} />
      </div>

      <div className="mt-4 text-sm">
        <Link
          href={`/invoices/${data.id}`}
          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Skip for now →
        </Link>
      </div>
    </div>
  );
}
