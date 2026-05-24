"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/app/lib/invoice";
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
  const sameCurrency =
    quote && quote.currency === invoiceCurrency.toUpperCase();
  const unavailable = quote && quote.amount === null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Transfer to this account</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Pick the currency you want to send. The SME&apos;s {accountCurrency}{" "}
          account receives the funds; your bank handles the conversion.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="bt_region"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Pay in
        </label>
        <select
          id="bt_region"
          value={region}
          onChange={(e) => setRegion(e.target.value as RegionCode)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        >
          {quotes.map((q) => (
            <option key={q.region} value={q.region}>
              {q.label} ({q.currency})
            </option>
          ))}
        </select>
        {unavailable ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            FX rate unavailable for this currency — try another or refresh later.
          </p>
        ) : sameCurrency ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Same as invoice currency — no conversion needed.
          </p>
        ) : quote && quote.rate ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            1 {invoiceCurrency.toUpperCase()} = {quote.rate.toFixed(4)}{" "}
            {quote.currency} · mid-market rate on {quote.rateDate}
          </p>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-3 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <Row label="Bank" value={bankName} />
        <Row
          label="Account number"
          value={accountNumber || "(not configured)"}
          mono
        />
        <Row
          label="Amount to transfer"
          value={
            quote && quote.amount !== null
              ? formatMoney(quote.amount, quote.currency)
              : "—"
          }
        />
        <Row
          label="Invoice total"
          value={formatMoney(invoiceAmount, invoiceCurrency)}
        />
        <Row label="Reference" value={invoiceNo} mono />
      </dl>

      <Link
        href={`/invoices/${invoiceId}/proof`}
        className="rounded-full bg-zinc-900 px-5 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
      >
        I have completed the transfer — upload proof
      </Link>

      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        ClearLedge will cross-check the transfer against the SME&apos;s bank
        notification email before marking the invoice paid.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={mono ? "font-mono text-sm" : "text-sm font-medium"}>
        {value}
      </dd>
    </div>
  );
}
