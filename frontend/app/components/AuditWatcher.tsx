"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 2000;
const WATCH_CAP_MS = 3 * 60 * 1000;

export function AuditWatcher({
  invoiceId,
  initialCount,
}: {
  invoiceId: string;
  initialCount: number;
}) {
  const router = useRouter();
  const lastCount = useRef(initialCount);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    lastCount.current = initialCount;
    startedAt.current = Date.now();
  }, [initialCount, invoiceId]);

  useEffect(() => {
    if (initialCount > 0) return;
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/audit`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { entries: { id: string }[] };
        if (cancelled) return;
        if (json.entries.length !== lastCount.current) {
          lastCount.current = json.entries.length;
          router.refresh();
        }
      } catch {}
      if (Date.now() - startedAt.current > WATCH_CAP_MS) {
        cancelled = true;
      }
    }
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    tick();
    return () => { cancelled = true; clearInterval(handle); };
  }, [invoiceId, initialCount, router]);

  return null;
}
