"use client";

import Link from "next/link";
import { useState } from "react";
import { Upload } from "lucide-react";
import { formatMoney } from "@/app/lib/invoice";
import { Flag, clsx } from "@/app/components/ui/primitives";
import type { RegionCode } from "@/app/lib/regions";

export type BankTransferQuote = {
  region: RegionCode;
  label: string;
  currency: string;
  amount: number | null;
  rate: number | null;
  rateDate: string | null;
};

type Props = {
  invoiceId: string;
  invoiceNo: string;
  invoiceAmount: number;
  invoiceCurrency: string;
  accountNumber: string;
  accountCurrency: string;
  bankName: string;
  quotes: BankTransferQuote[];
};

export function BankTransferPanel({
  invoiceId,
  invoiceNo,
  invoiceAmount,
  invoiceCurrency,
  accountNumber,
  accountCurrency,
  bankName,
  quotes,
}: Props) {
  const defaultRegion =
    quotes.find((q) => q.currency === invoiceCurrency.toUpperCase())?.region ??
    quotes[0]?.region ??
    ("SG" as RegionCode);
  const [region, setRegion] = useState<RegionCode>(defaultRegion);
  const quote = quotes.find((q) => q.region === region) ?? quotes[0];
  const sameCurrency = quote && quote.currency === invoiceCurrency.toUpperCase();
  const unavailable = quote && quote.amount === null;

  return (
    <div className="cl-stack-4">
      <div>
        <div className="cl-h3" style={{ marginBottom: 8 }}>Pay in</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {quotes.map((q) => (
            <button
              key={q.region}
              type="button"
              onClick={() => setRegion(q.region)}
              className={clsx("cl-pay-method", region === q.region && "is-active")}
              style={{ flexDirection: "column", padding: "10px 6px", gap: 6, justifyContent: "center" }}
            >
              <Flag code={q.region} />
              <span style={{ fontSize: 11, fontWeight: 500 }}>{q.currency}</span>
            </button>
          ))}
        </div>
        {unavailable ? (
          <p style={{ color: "var(--cl-rose)", fontSize: 11, marginTop: 8 }}>
            FX unavailable — try another currency.
          </p>
        ) : sameCurrency ? (
          <p className="cl-subtle" style={{ fontSize: 11, marginTop: 8 }}>Same as invoice currency — no conversion.</p>
        ) : quote?.rate ? (
          <p className="cl-subtle" style={{ fontSize: 11, marginTop: 8 }}>
            1 {invoiceCurrency.toUpperCase()} = {quote.rate.toFixed(4)} {quote.currency} · mid-market on {quote.rateDate}
          </p>
        ) : null}
      </div>

      <div className="cl-card" style={{ border: "1px solid var(--cl-border)" }}>
        <div className="cl-card-row cl-row-between">
          <span className="cl-h3" style={{ textTransform: "none" }}>Bank</span>
          <span style={{ fontSize: 13 }}>{bankName}</span>
        </div>
        <div className="cl-card-row cl-row-between">
          <span className="cl-h3" style={{ textTransform: "none" }}>Account ({accountCurrency})</span>
          <span className="cl-mono" style={{ fontSize: 13 }}>{accountNumber || "(not configured)"}</span>
        </div>
        <div className="cl-card-row cl-row-between">
          <span className="cl-h3" style={{ textTransform: "none" }}>Amount to transfer</span>
          <span className="cl-mono" style={{ fontSize: 13, color: "var(--cl-fg)" }}>
            {quote && quote.amount !== null ? formatMoney(quote.amount, quote.currency) : "—"}
          </span>
        </div>
        <div className="cl-card-row cl-row-between">
          <span className="cl-h3" style={{ textTransform: "none" }}>Invoice total</span>
          <span className="cl-mono" style={{ fontSize: 12, color: "var(--cl-fg-muted)" }}>
            {formatMoney(invoiceAmount, invoiceCurrency)}
          </span>
        </div>
        <div className="cl-card-row cl-row-between">
          <span className="cl-h3" style={{ textTransform: "none" }}>Reference</span>
          <span className="cl-mono" style={{ fontSize: 13 }}>{invoiceNo}</span>
        </div>
      </div>

      <Link href={`/invoices/${invoiceId}/proof`} className="cl-btn is-primary is-block is-lg">
        <Upload size={14} /> Transfer complete — upload proof
      </Link>

      <p className="cl-subtle" style={{ fontSize: 11, lineHeight: 1.5 }}>
        ClearLedge cross-checks your transfer against the SME&apos;s bank notification
        email before marking the invoice paid.
      </p>
    </div>
  );
}
