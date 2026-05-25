"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

function localDatetimeNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ManualPaymentForm({
  invoiceId,
  defaultAmount,
  defaultCurrency,
}: {
  invoiceId: string;
  defaultAmount: number;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState(String(defaultAmount));
  const [currency, setCurrency] = React.useState(defaultCurrency.toUpperCase());
  const [paidAt, setPaidAt] = React.useState(localDatetimeNow());
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_received: Number(amount),
          currency_received: currency.trim().toUpperCase(),
          paid_at: new Date(paidAt).toISOString(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cl-card">
      <div className="cl-card-head"><h2>Mark as paid manually</h2></div>
      <div className="cl-card-pad cl-stack-3">
        <p className="cl-subtle" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          Fallback for when the bank notification email hasn&apos;t arrived or Gmail isn&apos;t
          connected. Records a settlement transaction, flips the invoice to PAID, and runs
          the reconciliation pipeline against any uploaded proof.
        </p>
        <form onSubmit={onSubmit} className="cl-stack-3">
          <div className="cl-field">
            <label htmlFor="mp-amount">Amount received</label>
            <input
              id="mp-amount"
              className="cl-input"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="cl-field">
            <label htmlFor="mp-currency">Currency</label>
            <input
              id="mp-currency"
              className="cl-input"
              type="text"
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="cl-field">
            <label htmlFor="mp-paid-at">Paid at</label>
            <input
              id="mp-paid-at"
              className="cl-input"
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              required
            />
          </div>
          {error ? <div className="cl-pill is-rose">{error}</div> : null}
          <button
            type="submit"
            className="cl-btn is-primary"
            disabled={submitting}
            style={{ alignSelf: "flex-start" }}
          >
            {submitting ? "Recording…" : "Record payment"}
          </button>
        </form>
      </div>
    </div>
  );
}
