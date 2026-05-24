"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { formatDate } from "@/app/lib/invoice";

export type AuditEntry = {
  id: string;
  status: InvoiceStatus;
  confidence: number;
  summary: string;
  reasons: string[];
  capped: boolean;
  created_at: string;
};

const POLL_INTERVAL_MS = 2000;
// Long enough to cover the slowest case: ~10 Chutes calls (~5-30s each) for
// the first orchestrator run, the 5-minute retry-once delay for
// BANK_TRANSFER, plus the second run. 10 minutes leaves slack.
const MAX_POLL_MS = 10 * 60 * 1000;

export function AuditTrail({
  invoiceId,
  initialEntries,
  initialPending,
}: {
  invoiceId: string;
  initialEntries: AuditEntry[];
  initialPending: boolean;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>(initialEntries);
  const [pending, setPending] = useState(initialPending);
  const [retryError, setRetryError] = useState<string | null>(null);
  const baselineCount = useRef(initialEntries.length);
  const startedAt = useRef(Date.now());

  async function handleRetry() {
    setRetryError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/retry`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Retry failed");
      }
      baselineCount.current = entries.length;
      startedAt.current = Date.now();
      setPending(true);
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Retry failed");
    }
  }

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/audit`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { entries: AuditEntry[] };
        if (cancelled) return;
        // Keep refreshing entries on every tick so the BANK_TRANSFER
        // retry-once run also surfaces without a manual refresh. We only
        // stop polling once the MAX_POLL_MS window has elapsed.
        if (json.entries.length !== entries.length) {
          setEntries(json.entries);
          router.refresh();
        }
      } catch {
        // swallow — try again next tick
      }
      if (Date.now() - startedAt.current > MAX_POLL_MS) {
        if (!cancelled) setPending(false);
      }
    }

    const handle = setInterval(tick, POLL_INTERVAL_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [pending, invoiceId, entries.length, router]);

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Audit trail</h2>
        <div className="flex items-center gap-3">
          {pending ? (
            <span className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Reconciling…
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleRetry}
            disabled={pending}
            title="Re-run the reconciliation pipeline"
            aria-label="Retry reconciliation"
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <RetryIcon className={pending ? "animate-spin" : ""} />
            Retry
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Every Matcher decision recorded for this invoice.
      </p>
      {retryError ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {retryError}
        </p>
      ) : null}

      {pending && entries.length === 0 ? (
        <div className="mt-4 space-y-3">
          <SkeletonRow />
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          No matcher runs yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((entry) => (
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
  );
}

function RetryIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 ${className}`}
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-12 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="mt-3 h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
