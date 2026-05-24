"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Send, ChevronLeft } from "lucide-react";
import {
  InvoiceData,
  clearDraft,
  formatDate,
  formatMoney,
  loadDraft,
} from "@/app/lib/invoice";
import { clsx } from "@/app/components/ui/primitives";

const STEPS = ["Client & amount", "Settlement", "Review", "Send"];
const STORAGE_EVENT = "clearledge:draft-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

let cachedSnapshot: { raw: string | null; value: InvoiceData | null } = { raw: null, value: null };
function getClientSnapshot(): InvoiceData | null {
  const raw = sessionStorage.getItem("clearledge:invoice-draft");
  if (raw === cachedSnapshot.raw) return cachedSnapshot.value;
  cachedSnapshot = { raw, value: loadDraft() };
  return cachedSnapshot.value;
}
function getServerSnapshot(): InvoiceData | null { return null; }

const PdfPanel = dynamic(() => import("./PdfPanel").then((m) => m.PdfPanel), {
  ssr: false,
  loading: () => (
    <div className="cl-card cl-card-pad cl-empty" style={{ height: 640 }}>Preparing PDF preview…</div>
  ),
});

export default function SendInvoicePage() {
  const router = useRouter();
  const draft = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const [emailOverride, setEmailOverride] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = emailOverride ?? draft?.client_email ?? "";

  async function handleSend() {
    if (!draft) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, recipient_email: email }),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(json.error ?? "Failed to send");
      clearDraft();
      router.push(`/invoices/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
      setSending(false);
    }
  }

  const summary = useMemo(() => {
    if (!draft) return null;
    return { amount: formatMoney(draft.amount, draft.currency), due: formatDate(draft.due_date) };
  }, [draft]);

  if (!draft) {
    return (
      <div className="cl-empty">
        <p style={{ marginBottom: 16 }}>No invoice in progress.</p>
        <Link href="/invoices/new" className="cl-btn is-primary">Create invoice</Link>
      </div>
    );
  }

  return (
    <>
      <Link href="/invoices/new" className="cl-btn is-ghost is-sm" style={{ marginBottom: 12 }}>
        <ChevronLeft size={14} /> Edit invoice
      </Link>

      <div className="cl-page-head">
        <div className="cl-page-title">
          <h1 className="cl-h1">Review &amp; send</h1>
          <p>Invoice {draft.invoice_number} · {draft.client_name}</p>
        </div>
      </div>

      <div className="cl-stepper">
        {STEPS.map((s, i) => (
          <span key={s} className="cl-row-gap" style={{ alignItems: "center" }}>
            <span className={clsx("cl-step", i < 2 && "is-done", i === 2 && "is-active")}>
              <span className="cl-step-no">{i + 1}</span>
              <span>{s}</span>
            </span>
            {i < STEPS.length - 1 ? <span className="cl-step-line" /> : null}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 18 }}>
        <div className="cl-stack-4">
          <div className="cl-card cl-card-pad" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <Summary label="Client" value={draft.client_name} />
            <Summary label="Amount" value={summary?.amount ?? ""} />
            <Summary label="Due" value={summary?.due ?? ""} />
          </div>
          <PdfPanel data={draft} />
        </div>

        <aside className="cl-card cl-card-pad cl-stack-4" style={{ position: "sticky", top: 12, alignSelf: "start" }}>
          <div>
            <h2 className="cl-h2" style={{ marginBottom: 4 }}>Email delivery</h2>
            <p className="cl-subtle" style={{ fontSize: 12, margin: 0 }}>The PDF and Stripe link will go to this address.</p>
          </div>
          <div className="cl-field">
            <label htmlFor="recipient_email">Recipient email</label>
            <input
              id="recipient_email"
              type="email"
              value={email}
              onChange={(e) => setEmailOverride(e.target.value)}
              className="cl-input"
            />
          </div>
          <button type="button" onClick={handleSend} disabled={sending || !email} className="cl-btn is-primary is-block is-lg">
            <Send size={14} />
            {sending ? "Sending…" : "Send payment link"}
          </button>
          {error ? <p className="cl-pill is-rose" style={{ alignSelf: "stretch" }}>{error}</p> : null}
        </aside>
      </div>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="cl-stack-2">
      <span className="cl-h3">{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
