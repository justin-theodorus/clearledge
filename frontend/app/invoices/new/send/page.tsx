"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { InvoiceData, formatDate, formatMoney, loadDraft } from "@/app/lib/invoice";

const STORAGE_EVENT = "clearledge:draft-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

let cachedSnapshot: { raw: string | null; value: InvoiceData | null } = {
  raw: null,
  value: null,
};

function getClientSnapshot(): InvoiceData | null {
  const raw = sessionStorage.getItem("clearledge:invoice-draft");
  if (raw === cachedSnapshot.raw) return cachedSnapshot.value;
  cachedSnapshot = { raw, value: loadDraft() };
  return cachedSnapshot.value;
}

function getServerSnapshot(): InvoiceData | null {
  return null;
}

const PdfPanel = dynamic(() => import("./PdfPanel").then((m) => m.PdfPanel), {
  ssr: false,
  loading: () => (
    <div className="flex h-[640px] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      Preparing PDF preview…
    </div>
  ),
});

export default function SendInvoicePage() {
  const draft = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [emailOverride, setEmailOverride] = useState<string | null>(null);
  const email = emailOverride ?? draft?.client_email ?? "";

  const summary = useMemo(() => {
    if (!draft) return null;
    return {
      amount: formatMoney(draft.amount, draft.currency),
      due: formatDate(draft.due_date),
    };
  }, [draft]);

  if (!draft) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-20 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          No invoice in progress
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Start by creating a new invoice — you&apos;ll come back here to
          preview and send the payment link.
        </p>
        <Link
          href="/invoices/new"
          className="mt-6 inline-block rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
        >
          Create invoice
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Send payment link
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Invoice {draft.invoice_number} · {draft.client_name}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Edit invoice
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            <SummaryItem label="Client" value={draft.client_name} />
            <SummaryItem label="Amount" value={summary?.amount ?? ""} />
            <SummaryItem label="Due" value={summary?.due ?? ""} />
          </div>
          <PdfPanel data={draft} />
        </div>

        <aside className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h2 className="text-base font-semibold">Email to client</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              The PDF and a Stripe payment link will be sent to this address.
            </p>
          </div>
          <label
            htmlFor="recipient_email"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Recipient email
          </label>
          <input
            id="recipient_email"
            type="email"
            value={email}
            onChange={(e) => setEmailOverride(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
            placeholder="finance@budicorp.com"
          />
          <button
            type="button"
            onClick={() => {}}
            className="mt-2 w-full rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
          >
            Send payment link
          </button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Sending will be wired up once the backend is online.
          </p>
        </aside>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
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
