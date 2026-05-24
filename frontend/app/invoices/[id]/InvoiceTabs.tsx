"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Mail, FileText, ArrowRight } from "lucide-react";
import { InvoiceStatus } from "@/app/components/StatusBadge";
import { ConfBar, Money, clsx } from "@/app/components/ui/primitives";
import { formatDate, formatMoney } from "@/app/lib/invoice";
import { REGIONS } from "@/app/lib/regions";

type Invoice = {
  id: string;
  invoice_no: string;
  client_name: string;
  client_email: string;
  amount: number;
  currency: string;
  due_date: string | null;
  status: InvoiceStatus;
  payment_link: string | null;
  payment_method: "STRIPE" | "BANK_TRANSFER";
  created_at: string;
};

type Txn = {
  amount_received: number;
  currency_received: string;
  amount_converted: number | null;
  fx_rate: number | null;
  fx_timestamp: string | null;
  stripe_payment_intent: string | null;
  paid_at: string;
};

type Proof = {
  id: string;
  proof_url: string;
  extracted_data: Record<string, unknown> | null;
  match_confidence: number | null;
  match_status: string | null;
  uploaded_at: string;
};

type Audit = {
  status: InvoiceStatus;
  confidence: number;
  summary: string;
  reasons: string[];
  capped: boolean;
  created_at: string;
  signals?: Record<string, unknown>;
};

type TabKey = "overview" | "transactions" | "proof" | "reconciliation" | "audit";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "transactions", label: "Transactions" },
  { key: "proof", label: "Proof" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "audit", label: "Audit log" },
];

export function InvoiceTabs({
  defaultTab,
  invoice,
  proof,
  txn,
  latestAudit,
  auditCount,
  copyLinkButton,
  auditTrail,
}: {
  defaultTab: string;
  invoice: Invoice;
  proof: Proof | null;
  txn: Txn | null;
  latestAudit: Audit | null;
  auditCount: number;
  copyLinkButton: React.ReactNode;
  auditTrail: React.ReactNode;
}) {
  const initial = (TABS.find((t) => t.key === defaultTab)?.key ?? "overview") as TabKey;
  const [active, setActive] = React.useState<TabKey>(initial);

  return (
    <div>
      <div className="cl-tabs">
        {TABS.map((t) => {
          let count: number | null = null;
          if (t.key === "audit") count = auditCount;
          if (t.key === "proof" && proof) count = 1;
          if (t.key === "transactions" && txn) count = 1;
          return (
            <button
              key={t.key}
              className={clsx(active === t.key && "is-active")}
              onClick={() => setActive(t.key)}
              type="button"
            >
              {t.label}
              {count !== null ? <span className="cl-tab-count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {active === "overview" ? <OverviewTab invoice={invoice} copyLinkButton={copyLinkButton} /> : null}
      {active === "transactions" ? <TransactionsTab invoice={invoice} txn={txn} /> : null}
      {active === "proof" ? <ProofTab invoice={invoice} proof={proof} /> : null}
      {active === "reconciliation" ? <ReconciliationTab latestAudit={latestAudit} /> : null}
      {active === "audit" ? <div>{auditTrail}</div> : null}
    </div>
  );
}

/* ============ Overview ============ */
function OverviewTab({ invoice, copyLinkButton }: { invoice: Invoice; copyLinkButton: React.ReactNode }) {
  return (
    <div className="cl-grid-2">
      <div className="cl-stack-4">
        <div className="cl-card">
          <div className="cl-card-head"><h2>Payment link</h2>{copyLinkButton}</div>
          <div className="cl-card-pad">
            {invoice.payment_link ? (
              <div className="cl-stack-3">
                <div className="cl-code-block">{invoice.payment_link}</div>
                <a href={invoice.payment_link} target="_blank" rel="noreferrer" className="cl-btn is-primary is-sm" style={{ alignSelf: "flex-start" }}>
                  <ExternalLink size={12} /> Open in new tab
                </a>
              </div>
            ) : (
              <p className="cl-subtle">No payment link on file yet.</p>
            )}
          </div>
        </div>

        <div className="cl-card">
          <div className="cl-card-head"><h2>Accepted methods</h2></div>
          <div className="cl-card-pad" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {Object.entries(REGIONS).map(([code, r]) => (
              <div key={code} className="cl-pay-method">
                <div className="cl-pay-icon">{code}</div>
                <div className="cl-stack" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{r.label.replace(/^\S+\s/, "")}</span>
                  <span className="cl-subtle" style={{ fontSize: 11 }}>{r.methods.join(" · ")}</span>
                </div>
                <span className="cl-tag">{r.currency}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cl-stack-4">
        <div className="cl-card">
          <div className="cl-card-head"><h2>Client</h2></div>
          <div className="cl-card-pad cl-stack-3">
            <Row label="Name" value={invoice.client_name} />
            <Row label="Email" value={invoice.client_email} icon={<Mail size={12} />} />
            <Row label="Method" value={invoice.payment_method.replace("_", " ")} />
            <Row label="Issued" value={formatDate(invoice.created_at)} />
          </div>
        </div>
        <div className="cl-card">
          <div className="cl-card-head"><h2>Quick actions</h2></div>
          <div className="cl-card-pad cl-stack-3">
            <Link href={`/invoices/${invoice.id}/proof`} className="cl-btn is-block">
              <FileText size={13} /> Upload payment proof
            </Link>
            <Link href={`/invoices/${invoice.id}/pay`} className="cl-btn is-block">
              <ExternalLink size={12} /> View public pay page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Transactions ============ */
function TransactionsTab({ invoice, txn }: { invoice: Invoice; txn: Txn | null }) {
  if (!txn) {
    return <div className="cl-card cl-card-pad cl-empty">No settlement transaction recorded yet.</div>;
  }
  const sameCurrency = txn.currency_received.toUpperCase() === invoice.currency.toUpperCase();
  return (
    <div className="cl-grid-2">
      <div className="cl-stack-4">
        <div className="cl-card">
          <div className="cl-card-head"><h2>Settlement</h2></div>
          <div className="cl-card-pad cl-stack-3">
            <Row label="Received" value={formatMoney(Number(txn.amount_received), txn.currency_received)} mono />
            <Row label="Invoiced" value={formatMoney(Number(invoice.amount), invoice.currency)} mono />
            <Row label="Settled on" value={formatDate(txn.paid_at)} />
            {txn.stripe_payment_intent ? (
              <Row label="Stripe PI" value={txn.stripe_payment_intent} mono />
            ) : null}
          </div>
        </div>

        <div className="cl-card">
          <div className="cl-card-head"><h2>FX legs</h2></div>
          <div className="cl-card-pad">
            {sameCurrency ? (
              <p className="cl-subtle">Same currency — no conversion required.</p>
            ) : (
              <div className="cl-row-gap" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <FxNode currency={invoice.currency} amount={Number(invoice.amount)} label="Invoice" />
                <ArrowRight size={16} color="var(--cl-fg-subtle)" />
                <FxNode currency={txn.currency_received} amount={Number(txn.amount_received)} label="Settlement" />
                <div style={{ flexBasis: "100%" }}>
                  <div className="cl-h3" style={{ marginBottom: 4 }}>Captured rate</div>
                  <div className="cl-mono">{txn.fx_rate ? Number(txn.fx_rate).toFixed(6) : "—"}</div>
                  <div className="cl-subtle" style={{ fontSize: 11 }}>
                    {txn.fx_timestamp ? `at ${formatDate(txn.fx_timestamp)}` : ""}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="cl-stack-4">
        <div className="cl-card">
          <div className="cl-card-head"><h2>Balance transaction</h2></div>
          <div className="cl-card-pad cl-stack-3">
            <Row label="Source" value={invoice.payment_method === "BANK_TRANSFER" ? "Bank notification (Gmail)" : "Stripe webhook"} />
            <Row label="Captured at" value={txn.fx_timestamp ? formatDate(txn.fx_timestamp) : "—"} />
            <Row label="Converted" value={txn.amount_converted !== null ? formatMoney(Number(txn.amount_converted), invoice.currency) : "—"} mono />
          </div>
        </div>
        <div className="cl-card cl-card-pad">
          <p className="cl-subtle" style={{ fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            The FX rate is captured at settlement time from Stripe&apos;s
            <span className="cl-mono"> balance_transaction.exchange_rate</span>{" "}
            (or Frankfurter for bank transfers) so the ledger has an immutable
            audit trail. The matcher uses this rate when scoring the proof.
          </p>
        </div>
      </div>
    </div>
  );
}

function FxNode({ currency, amount, label }: { currency: string; amount: number; label: string }) {
  return (
    <div className="cl-stack-2">
      <span className="cl-h3">{label}</span>
      <div className="cl-mono" style={{ fontSize: 16 }}>
        <Money amount={amount} currency={currency} />
      </div>
    </div>
  );
}

/* ============ Proof ============ */
function ProofTab({ invoice, proof }: { invoice: Invoice; proof: Proof | null }) {
  if (!proof) {
    return (
      <div className="cl-card cl-card-pad cl-empty">
        No proof uploaded yet.{" "}
        <Link href={`/invoices/${invoice.id}/proof`} className="cl-link">Upload now →</Link>
      </div>
    );
  }
  const isImage = /\.(png|jpe?g|gif|webp|heic|avif)(\?|$)/i.test(proof.proof_url);
  const extracted = proof.extracted_data ?? {};
  const fields: Array<{ key: string; label: string }> = [
    { key: "amount", label: "Amount" },
    { key: "currency", label: "Currency" },
    { key: "sender", label: "Sender" },
    { key: "date", label: "Date" },
    { key: "reference", label: "Reference" },
  ];
  return (
    <div className="cl-grid-2">
      <div className="cl-card">
        <div className="cl-card-head"><h2>Uploaded receipt</h2><span className="cl-subtle" style={{ fontSize: 11 }}>{formatDate(proof.uploaded_at)}</span></div>
        <div className="cl-card-pad">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proof.proof_url}
              alt="Payment proof"
              style={{ width: "100%", borderRadius: "var(--cl-radius-md)", border: "1px solid var(--cl-border)" }}
            />
          ) : (
            <a href={proof.proof_url} target="_blank" rel="noreferrer" className="cl-btn">
              <ExternalLink size={12} /> Open document
            </a>
          )}
        </div>
      </div>

      <div className="cl-card">
        <div className="cl-card-head"><h2>Extracted by Extractor</h2></div>
        <div className="cl-card-pad cl-stack-3">
          {fields.map((f) => {
            const v = (extracted as Record<string, unknown>)[f.key];
            const conf = (extracted as Record<string, unknown>)[`${f.key}_confidence`];
            return (
              <div key={f.key}>
                <div className="cl-row-between">
                  <span className="cl-h3">{f.label}</span>
                  <span className="cl-mono" style={{ fontSize: 12 }}>
                    {v !== undefined && v !== null ? String(v) : <span className="cl-faint">—</span>}
                  </span>
                </div>
                {typeof conf === "number" ? (
                  <div style={{ marginTop: 6 }}><ConfBar value={Number(conf)} /></div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============ Reconciliation ============ */
function ReconciliationTab({ latestAudit }: { latestAudit: Audit | null }) {
  if (!latestAudit) {
    return <div className="cl-card cl-card-pad cl-empty">No reconciliation run yet.</div>;
  }
  const rawSignals = (latestAudit.signals ?? {}) as Record<string, unknown>;
  const signal = (k: string): number => {
    const v = rawSignals[`${k}_score`] ?? rawSignals[k];
    const n = typeof v === "string" ? Number(v) : (typeof v === "number" ? v : NaN);
    return Number.isFinite(n) ? n : 0;
  };
  const weights: Array<{ key: string; label: string; weight: number }> = [
    { key: "amount", label: "Amount", weight: 0.5 },
    { key: "date", label: "Date proximity", weight: 0.2 },
    { key: "sender", label: "Sender name", weight: 0.2 },
    { key: "reference", label: "Reference", weight: 0.1 },
  ];
  return (
    <div className="cl-grid-2">
      <div className="cl-card">
        <div className="cl-card-head"><h2>Score breakdown</h2></div>
        <div className="cl-card-pad">
          <table className="cl-match-table">
            <tbody>
              {weights.map((w) => {
                const score = signal(w.key);
                return (
                  <tr key={w.key}>
                    <td>
                      <div className="cl-stack-2">
                        <span>{w.label}</span>
                        <span className="cl-subtle" style={{ fontSize: 11 }}>weight {w.weight.toFixed(2)}</span>
                      </div>
                    </td>
                    <td style={{ width: 160 }}>
                      <ConfBar value={score} />
                    </td>
                    <td style={{ width: 60 }}>{score.toFixed(3)}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={2}><strong>Composite</strong></td>
                <td><strong>{Number(latestAudit.confidence).toFixed(3)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="cl-stack-4">
        <div className="cl-card">
          <div className="cl-card-head"><h2>Thresholds</h2></div>
          <div className="cl-card-pad cl-stack-3" style={{ fontSize: 12.5 }}>
            <ThresholdRow color="var(--cl-emerald)" label="≥ 0.85" desc="Auto-close · RECONCILED" />
            <ThresholdRow color="var(--cl-amber)" label="0.60–0.85" desc="Hold for review · PARTIAL" />
            <ThresholdRow color="var(--cl-rose)" label="< 0.60" desc="Reject · UNVERIFIED" />
          </div>
        </div>
        <div className="cl-card cl-card-pad">
          <div className="cl-h3" style={{ marginBottom: 8 }}>Resolution</div>
          <p className="cl-subtle" style={{ fontSize: 12, lineHeight: 1.5 }}>{latestAudit.summary}</p>
          {latestAudit.reasons?.length ? (
            <ul style={{ marginTop: 8, paddingLeft: 16, fontSize: 12, color: "var(--cl-fg-muted)" }}>
              {latestAudit.reasons.slice(0, 4).map((r, i) => <li key={i} style={{ marginBottom: 3 }}>{r}</li>)}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ThresholdRow({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="cl-row-gap">
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      <span className="cl-mono" style={{ width: 90 }}>{label}</span>
      <span>{desc}</span>
    </div>
  );
}

/* Shared row */
function Row({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="cl-row-between">
      <span className="cl-h3">{label}</span>
      <span className={clsx(mono && "cl-mono")} style={{ fontSize: 13, color: "var(--cl-fg)", display: "inline-flex", alignItems: "center", gap: 6 }}>
        {icon}{value}
      </span>
    </div>
  );
}
