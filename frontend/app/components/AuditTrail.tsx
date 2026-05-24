"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { ConfBar, ConfPill, clsx } from "@/app/components/ui/primitives";
import { formatDate } from "@/app/lib/invoice";

export type AuditEntry = {
  id: string;
  status: InvoiceStatus;
  confidence: number;
  summary: string;
  reasons: string[];
  capped: boolean;
  signals?: Record<string, unknown> | null;
  created_at: string;
};

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 10 * 60 * 1000;

function toneFor(status: InvoiceStatus): "emerald" | "amber" | "rose" | "primary" {
  if (status === "RECONCILED") return "emerald";
  if (status === "PARTIAL") return "amber";
  if (status === "UNVERIFIED" || status === "ERROR") return "rose";
  return "primary";
}

const SIGNAL_FIELDS = [
  { key: "amount", label: "Amount" },
  { key: "date", label: "Date" },
  { key: "sender", label: "Sender" },
  { key: "reference", label: "Reference" },
] as const;

function SignalChips({ signals }: { signals: Record<string, unknown> }) {
  const items = SIGNAL_FIELDS.map((f) => {
    const raw = signals[`${f.key}_score`];
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    return { ...f, score: Number.isFinite(n) ? n : null };
  });
  if (items.every((i) => i.score === null)) return null;
  return (
    <div className="cl-sig-grid">
      {items.map((i) => (
        <div key={i.key} className="cl-sig-chip">
          <div className="cl-sig-head">
            <span>{i.label}</span>
            <span className="cl-mono">{i.score !== null ? i.score.toFixed(2) : "—"}</span>
          </div>
          <ConfBar value={i.score ?? 0} />
        </div>
      ))}
    </div>
  );
}

function reasonIcon(reason: string, fallback: "emerald" | "amber" | "rose" | "primary") {
  const s = reason.toLowerCase();
  const negative =
    /\b(no |without|couldn't|can't|haven't|didn't|doesn't|does not|do not|outside|off by|rejected|reject|fail|missing|absent)\b/.test(s);
  const partial =
    /(partial|partially|mostly|inside the ±|safety cap|capped|held for review)/.test(s);
  const positive =
    /(exactly|same day|near-exact|strongly|well inside|includes the invoice|every check passed|matches the|match to the client)/.test(s);
  if (negative && positive) return { Icon: AlertTriangle, tone: "amber" as const };
  if (negative) return { Icon: XCircle, tone: "rose" as const };
  if (partial) return { Icon: AlertTriangle, tone: "amber" as const };
  if (positive) return { Icon: CheckCircle2, tone: "emerald" as const };
  return { Icon: Info, tone: fallback };
}

function ReasonList({ reasons, tone }: { reasons: string[]; tone: "emerald" | "amber" | "rose" | "primary" }) {
  return (
    <ul className="cl-reason-list">
      {reasons.map((r, i) => {
        const { Icon, tone: t } = reasonIcon(r, tone);
        return (
          <li key={i} className={clsx("cl-reason", `is-${t}`)}>
            <Icon size={13} className="cl-reason-icon" />
            <span>{r}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function AuditTrail({
  invoiceId,
  initialEntries,
}: {
  invoiceId: string;
  initialEntries: AuditEntry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>(initialEntries);
  const [pending, setPending] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);

  async function handleRetry() {
    setRetryError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/retry`, { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Retry failed");
      }
      startedAt.current = null;
      setPending(true);
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Retry failed");
    }
  }

  useEffect(() => {
    if (!pending) return;
    if (startedAt.current === null) startedAt.current = Date.now();
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/audit`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { entries: AuditEntry[] };
        if (cancelled) return;
        if (json.entries.length !== entries.length) {
          setEntries(json.entries);
          router.refresh();
        }
      } catch {}
      if (startedAt.current !== null && Date.now() - startedAt.current > MAX_POLL_MS) {
        if (!cancelled) setPending(false);
      }
    }
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    tick();
    return () => { cancelled = true; clearInterval(handle); };
  }, [pending, invoiceId, entries.length, router]);

  return (
    <div className="cl-card">
      <div className="cl-card-head">
        <h2>Audit timeline</h2>
        <div className="cl-row-gap">
          {pending ? (
            <span className="cl-row-gap" style={{ fontSize: 12, color: "var(--cl-amber)" }}>
              <span className="cl-pill-dot" style={{ background: "var(--cl-amber)" }} />
              Reconciling…
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleRetry}
            disabled={pending}
            className="cl-btn is-sm"
            title="Re-run the reconciliation pipeline"
          >
            <RotateCcw size={12} className={pending ? "cl-spin" : ""} />
            Retry
          </button>
        </div>
      </div>
      <div className="cl-card-pad">
        {retryError ? (
          <div className="cl-pill is-rose" style={{ marginBottom: 12 }}>{retryError}</div>
        ) : null}

        {pending && entries.length === 0 ? (
          <div className="cl-empty">Waiting for pipeline to start…</div>
        ) : entries.length === 0 ? (
          <div className="cl-empty">No reconciliation runs yet.</div>
        ) : (
          <ol className="cl-timeline" style={{ margin: 0, padding: 0, listStyle: "none", paddingLeft: 28 }}>
            {entries.map((e) => {
              const tone = toneFor(e.status);
              return (
                <li key={e.id} className={clsx("cl-tl-item", `is-${tone}`)}>
                  <span className="cl-tl-dot" />
                  <div className="cl-tl-head">
                    <StatusBadge status={e.status} />
                    <ConfPill value={Number(e.confidence)} />
                    {e.capped ? <span className="cl-tag" style={{ color: "var(--cl-amber)" }}>Capped</span> : null}
                    <span className="cl-tl-time">{formatDate(e.created_at)}</span>
                  </div>
                  {e.signals ? <SignalChips signals={e.signals} /> : null}
                  {e.reasons?.length ? <ReasonList reasons={e.reasons} tone={tone} /> : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
