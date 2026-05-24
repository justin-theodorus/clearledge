"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { StatusBadge, InvoiceStatus } from "@/app/components/StatusBadge";
import { Chip, ConfBar, Money, Flag, clsx } from "@/app/components/ui/primitives";
import { formatDate } from "@/app/lib/invoice";

export type InvoiceListRow = {
  id: string;
  invoice_no: string;
  client_name: string;
  client_email: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  created_at: string;
  due_date: string | null;
  payment_method: string;
  confidence: number | null;
};

const STATUSES: InvoiceStatus[] = [
  "RECONCILED",
  "PARTIAL",
  "UNVERIFIED",
  "PAID",
  "AWAITING_TRANSFER",
  "PENDING",
];

const CURRENCY_TO_REGION: Record<string, string> = {
  SGD: "SG",
  USD: "US",
  THB: "TH",
  MYR: "MY",
  IDR: "ID",
  PHP: "PH",
};

export function InvoicesTable({ rows }: { rows: InvoiceListRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeStatuses, setActiveStatuses] = useState<Set<InvoiceStatus>>(new Set());
  const [activeRegions, setActiveRegions] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (activeStatuses.size && !activeStatuses.has(r.status)) return false;
      const region = CURRENCY_TO_REGION[r.currency.toUpperCase()] ?? "";
      if (activeRegions.size && !activeRegions.has(region)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !r.invoice_no.toLowerCase().includes(q) &&
          !r.client_name.toLowerCase().includes(q) &&
          !r.client_email.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, query, activeStatuses, activeRegions]);

  const filterKey = `${query}|${[...activeStatuses].join(",")}|${[...activeRegions].join(",")}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (lastKey !== filterKey) {
    setLastKey(filterKey);
    setCursor(0);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "j") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, filtered.length - 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter" && filtered[cursor]) {
        e.preventDefault();
        router.push(`/invoices/${filtered[cursor].id}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, cursor, router]);

  function toggleStatus(s: InvoiceStatus) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }
  function toggleRegion(r: string) {
    setActiveRegions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }
  function clearAll() {
    setQuery("");
    setActiveStatuses(new Set());
    setActiveRegions(new Set());
  }

  return (
    <>
      <div className="cl-toolbar">
        <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Search
            size={14}
            color="var(--cl-fg-subtle)"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invoices, clients…"
            className="cl-input"
            style={{ paddingLeft: 32 }}
          />
        </div>
        {STATUSES.map((s) => (
          <Chip key={s} active={activeStatuses.has(s)} onClick={() => toggleStatus(s)}>
            {s.replace("_", " ")}
          </Chip>
        ))}
        <span style={{ width: 1, height: 18, background: "var(--cl-border)" }} />
        {["SG", "US", "TH", "MY"].map((r) => (
          <Chip key={r} active={activeRegions.has(r)} onClick={() => toggleRegion(r)}>
            <Flag code={r} /> {r}
          </Chip>
        ))}
        {(query || activeStatuses.size > 0 || activeRegions.size > 0) ? (
          <button type="button" className="cl-btn is-ghost is-sm" onClick={clearAll}>
            Clear
          </button>
        ) : null}
      </div>

      <div className="cl-table-wrap">
        <table className="cl-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Region</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Due</th>
              <th>Status</th>
              <th style={{ width: 120 }}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="cl-empty">No invoices match those filters.</td></tr>
            ) : filtered.map((r, i) => {
              const region = CURRENCY_TO_REGION[r.currency.toUpperCase()] ?? "—";
              return (
                <tr
                  key={r.id}
                  className={clsx(i === cursor && "is-selected")}
                  onClick={() => router.push(`/invoices/${r.id}`)}
                  onMouseEnter={() => setCursor(i)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <Link
                      href={`/invoices/${r.id}`}
                      className="cl-mono"
                      style={{ color: "var(--cl-fg)", textDecoration: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.invoice_no}
                    </Link>
                  </td>
                  <td>
                    <div className="cl-stack">
                      <span>{r.client_name}</span>
                      <span className="cl-subtle" style={{ fontSize: 11 }}>{r.client_email}</span>
                    </div>
                  </td>
                  <td><span className="cl-region-pill"><Flag code={region} /> {region}</span></td>
                  <td className="is-num"><Money amount={Number(r.amount)} currency={r.currency} /></td>
                  <td className="cl-subtle" style={{ fontSize: 11 }}>{r.payment_method.replace("_", " ")}</td>
                  <td className="cl-subtle">{r.due_date ? formatDate(r.due_date) : "—"}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.confidence !== null ? <ConfBar value={r.confidence} /> : <span className="cl-faint">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
