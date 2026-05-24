"use client";

import { useState } from "react";
import { REGIONS, RegionCode } from "@/app/lib/regions";
import { Flag, clsx } from "@/app/components/ui/primitives";

const REGION_ORDER: RegionCode[] = ["SG", "US", "TH", "MY"];

export function RegionPicker({
  invoiceId,
  defaultRegion = "SG",
}: {
  invoiceId: string;
  defaultRegion?: RegionCode;
}) {
  const [region, setRegion] = useState<RegionCode>(defaultRegion);
  const [method, setMethod] = useState<string>(REGIONS[defaultRegion].methods[0]);
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
    } catch {
      setError("Network error — try again");
      setSubmitting(false);
    }
  }

  function pickRegion(r: RegionCode) {
    setRegion(r);
    setMethod(REGIONS[r].methods[0]);
  }

  return (
    <div className="cl-stack-4">
      <div>
        <div className="cl-h3" style={{ marginBottom: 8 }}>Pay from</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {REGION_ORDER.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => pickRegion(code)}
              className={clsx("cl-pay-method", region === code && "is-active")}
              style={{ flexDirection: "column", padding: "10px 6px", gap: 6, justifyContent: "center" }}
            >
              <Flag code={code} />
              <span style={{ fontSize: 11, fontWeight: 500 }}>{REGIONS[code].currency}</span>
            </button>
          ))}
        </div>
        <p className="cl-subtle" style={{ fontSize: 11, marginTop: 8 }}>
          Charged in {REGIONS[region].currency} at today&apos;s mid-market rate.
        </p>
      </div>

      <div>
        <div className="cl-h3" style={{ marginBottom: 8 }}>Method</div>
        <div className="cl-stack-3">
          {REGIONS[region].methods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={clsx("cl-pay-method", method === m && "is-active")}
            >
              <span className="cl-pay-icon">{m.slice(0, 3).toUpperCase()}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>{m}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="cl-pill is-rose">{error}</div> : null}

      <button type="button" onClick={handlePay} disabled={submitting} className="cl-btn is-primary is-block is-lg">
        {submitting ? "Redirecting…" : `Pay with ${method}`}
      </button>
    </div>
  );
}
