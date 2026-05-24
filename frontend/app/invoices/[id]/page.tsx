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

  const { data: proof } = await supabase
    .from("proofs")
    .select("proof_url, uploaded_at")
    .eq("invoice_id", id)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const proofIsImage = proof?.proof_url
    ? /\.(png|jpe?g|gif|webp|heic|avif)(\?|$)/i.test(proof.proof_url)
    : false;

  const { data: auditData } = await supabase
    .from("audit_logs")
    .select("id,status,confidence,summary,reasons,capped,created_at")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false });
  const auditEntries = (auditData ?? []) as Array<{
    id: string;
    status: InvoiceStatus;
    confidence: number;
    summary: string;
    reasons: string[];
    capped: boolean;
    created_at: string;
  }>;

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
          {invoice.status === "PENDING"
            ? "Payment confirmed by Stripe — reconciling…"
            : "Payment received."}
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

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Proof of payment</h2>
          <Link
            href={`/invoices/${invoice.id}/proof`}
            className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {proof ? "Upload another" : "Upload"}
          </Link>
        </div>
        {proof ? (
          <div className="mt-3">
            {proofIsImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proof.proof_url}
                alt="Payment proof"
                className="max-h-64 rounded-md border border-zinc-200 object-contain dark:border-zinc-800"
              />
            ) : (
              <a
                href={proof.proof_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline"
              >
                Open proof file
              </a>
            )}
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Uploaded {formatDate(proof.uploaded_at)}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            No proof uploaded yet.
          </p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Audit trail</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Every Matcher decision recorded for this invoice.
        </p>
        {auditEntries.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            No matcher runs yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {auditEntries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={entry.status} />
                    <span className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                      {Number(entry.confidence).toFixed(3)}
                    </span>
                    {entry.capped ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        Capped
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(entry.created_at)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {entry.summary}
                </p>
                {entry.reasons?.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                      Reasons ({entry.reasons.length})
                    </summary>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {entry.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
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
