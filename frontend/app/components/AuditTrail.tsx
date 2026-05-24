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
const MAX_POLL_MS = 90_000;

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
  const baselineCount = useRef(initialEntries.length);
  const startedAt = useRef(Date.now());

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
        if (json.entries.length > baselineCount.current) {
          setEntries(json.entries);
          setPending(false);
          router.refresh();
          return;
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
  }, [pending, invoiceId, router]);

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Audit trail</h2>
        {pending ? (
          <span className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            Reconciling…
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Every Matcher decision recorded for this invoice.
      </p>

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
