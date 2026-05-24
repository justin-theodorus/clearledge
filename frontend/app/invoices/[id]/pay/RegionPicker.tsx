"use client";

import { useState } from "react";
import { REGIONS, RegionCode } from "@/app/lib/regions";

export function RegionPicker({
  invoiceId,
  defaultRegion = "SG",
}: {
  invoiceId: string;
  defaultRegion?: RegionCode;
}) {
  const [region, setRegion] = useState<RegionCode>(defaultRegion);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Failed to create payment session");
        setSubmitting(false);
        return;
      }
      window.location.assign(json.url);
    } catch (e) {
      console.error(e);
      setError("Network error — try again");
      setSubmitting(false);
    }
  }

  const presentment = REGIONS[region].currency;
  const methods = REGIONS[region].methods.join(", ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="region"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Pay from
        </label>
        <select
          id="region"
          value={region}
          onChange={(e) => setRegion(e.target.value as RegionCode)}
          disabled={submitting}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        >
          {(Object.keys(REGIONS) as RegionCode[]).map((code) => (
            <option key={code} value={code}>
              {REGIONS[code].label} ({REGIONS[code].currency})
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Charged in {presentment} · Methods: {methods}
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handlePay}
        disabled={submitting}
        className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
      >
        {submitting ? "Redirecting…" : "Pay invoice"}
      </button>
    </div>
  );
}
