"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { ConfPill } from "@/app/components/ui/primitives";

export type FeedEntry = {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  client: string;
  status: InvoiceStatus;
  confidence: number;
  summary: string;
  createdAt: string;
};

function headlineFor(status: InvoiceStatus): string {
  if (status === "RECONCILED") return "Auto-reconciled — all signals aligned.";
  if (status === "PARTIAL") return "Held for review — some signals didn't fully match.";
  if (status === "UNVERIFIED") return "Match rejected — signals didn't line up.";
  if (status === "ERROR") return "Pipeline error — needs another run.";
  return "Awaiting reconciliation.";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AgentActivityFeed({ initial }: { initial: FeedEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [, force] = useState(0);

  useEffect(() => {
    const tick = () => force((x) => x + 1);
    const t = setInterval(tick, 30_000);

    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/audit/recent", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { entries: FeedEntry[] };
        if (!cancelled && json.entries) setEntries(json.entries);
      } catch {}
    }
    const p = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
      clearInterval(p);
    };
  }, []);

  if (entries.length === 0) {
    return <div className="cl-empty">No agent activity yet.</div>;
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 280, overflowY: "auto" }}>
      {entries.map((e, i) => (
        <li
          key={e.id}
          className="cl-card-row"
          style={{
            opacity: 1 - i * 0.06,
            padding: "12px var(--cl-pad-card)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div className="cl-row-between">
            <Link
              href={`/invoices/${e.invoiceId}`}
              className="cl-mono"
              style={{ color: "var(--cl-fg)", textDecoration: "none", fontSize: 12 }}
            >
              {e.invoiceNo}
            </Link>
            <span className="cl-subtle" style={{ fontSize: 11 }}>{timeAgo(e.createdAt)}</span>
          </div>
          <div className="cl-row-gap">
            <StatusBadge status={e.status} />
            <ConfPill value={e.confidence} />
            <span className="cl-muted" style={{ fontSize: 12 }}>{e.client}</span>
          </div>
          <div className="cl-subtle" style={{ fontSize: 12, lineHeight: 1.4 }}>{headlineFor(e.status)}</div>
        </li>
      ))}
    </ul>
  );
}
