"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 2000;
const WATCH_CAP_MS = 5 * 60 * 1000;

type Snapshot = {
  hasProof: boolean;
  hasTxn: boolean;
  auditCount: number;
  invoiceStatus: string | null;
};

function equal(a: Snapshot, b: Snapshot) {
  return (
    a.hasProof === b.hasProof &&
    a.hasTxn === b.hasTxn &&
    a.auditCount === b.auditCount &&
    a.invoiceStatus === b.invoiceStatus
  );
}

export function AuditWatcher({
  invoiceId,
  initialCount,
  initialHasProof,
  initialHasTxn,
  initialInvoiceStatus,
}: {
  invoiceId: string;
  initialCount: number;
  initialHasProof: boolean;
  initialHasTxn: boolean;
  initialInvoiceStatus: string | null;
}) {
  const router = useRouter();
  const lastSnap = useRef<Snapshot>({
    hasProof: initialHasProof,
    hasTxn: initialHasTxn,
    auditCount: initialCount,
    invoiceStatus: initialInvoiceStatus,
  });
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    lastSnap.current = {
      hasProof: initialHasProof,
      hasTxn: initialHasTxn,
      auditCount: initialCount,
      invoiceStatus: initialInvoiceStatus,
    };
    startedAt.current = Date.now();
  }, [initialCount, initialHasProof, initialHasTxn, initialInvoiceStatus, invoiceId]);

  useEffect(() => {
    // Stop watching once we have a finalized audit verdict.
    const finalized =
      initialCount > 0 &&
      (initialInvoiceStatus === "RECONCILED" ||
        initialInvoiceStatus === "PARTIAL" ||
        initialInvoiceStatus === "UNVERIFIED" ||
        initialInvoiceStatus === "ERROR");
    if (finalized) return;

    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/pipeline-status`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Snapshot;
        if (cancelled) return;
        if (!equal(json, lastSnap.current)) {
          lastSnap.current = json;
          router.refresh();
        }
      } catch {}
      if (Date.now() - startedAt.current > WATCH_CAP_MS) {
        cancelled = true;
      }
    }
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [invoiceId, initialCount, initialInvoiceStatus, router]);

  return null;
}
