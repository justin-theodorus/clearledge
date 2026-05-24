"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { CreditCard, Building2 } from "lucide-react";
import {
  InvoiceData,
  PaymentMethod,
  generateInvoiceNumber,
  saveDraft,
} from "@/app/lib/invoice";

const CURRENCIES = ["USD", "MYR", "SGD", "IDR", "PHP", "THB"] as const;

export function InvoiceForm() {
  const router = useRouter();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: InvoiceData = {
      invoice_number: generateInvoiceNumber(),
      client_name: String(fd.get("client_name") ?? "").trim(),
      client_email: String(fd.get("client_email") ?? "").trim(),
      amount: Number(fd.get("amount") ?? 0),
      currency: String(fd.get("currency") ?? "USD"),
      due_date: String(fd.get("due_date") ?? ""),
      description: String(fd.get("description") ?? "").trim(),
      issued_at: new Date().toISOString(),
      payment_method: (String(fd.get("payment_method") ?? "STRIPE") as PaymentMethod),
    };
    saveDraft(data);
    router.push("/invoices/new/send");
  }

  return (
    <form onSubmit={handleSubmit} className="cl-stack-4">
      <div className="cl-field">
        <label htmlFor="client_name">Client name</label>
        <input id="client_name" name="client_name" required placeholder="Budi Corp" className="cl-input" />
      </div>
      <div className="cl-field">
        <label htmlFor="client_email">Client email</label>
        <input id="client_email" name="client_email" type="email" required placeholder="finance@budicorp.com" className="cl-input" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
        <div className="cl-field">
          <label htmlFor="amount">Amount</label>
          <input id="amount" name="amount" type="number" min="0" step="0.01" required placeholder="0.00" className="cl-input" />
        </div>
        <div className="cl-field">
          <label htmlFor="currency">Currency</label>
          <select id="currency" name="currency" defaultValue="USD" className="cl-select">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="cl-field">
        <label htmlFor="due_date">Due date</label>
        <input id="due_date" name="due_date" type="date" required className="cl-input" />
      </div>

      <div className="cl-field">
        <label>Payment method</label>
        <div className="cl-stack-3">
          <label className="cl-pay-method" style={{ cursor: "pointer" }}>
            <input type="radio" name="payment_method" value="STRIPE" defaultChecked style={{ marginRight: 4 }} />
            <CreditCard size={18} color="var(--cl-primary-400)" />
            <div className="cl-stack" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 500, fontSize: 13 }}>Stripe Checkout</span>
              <span className="cl-subtle" style={{ fontSize: 11 }}>Card, PayNow, GrabPay, FPX — settles automatically.</span>
            </div>
          </label>
          <label className="cl-pay-method" style={{ cursor: "pointer" }}>
            <input type="radio" name="payment_method" value="BANK_TRANSFER" style={{ marginRight: 4 }} />
            <Building2 size={18} color="var(--cl-primary-400)" />
            <div className="cl-stack" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 500, fontSize: 13 }}>Bank transfer</span>
              <span className="cl-subtle" style={{ fontSize: 11 }}>Client transfers manually. Proof + Gmail cross-check required.</span>
            </div>
          </label>
        </div>
      </div>

      <div className="cl-field">
        <label htmlFor="description">Description (optional)</label>
        <textarea id="description" name="description" rows={3} placeholder="What is this invoice for?" className="cl-textarea" />
      </div>

      <div className="cl-row-between" style={{ marginTop: 8 }}>
        <Link href="/" className="cl-btn is-ghost">Cancel</Link>
        <button type="submit" className="cl-btn is-primary">Continue →</button>
      </div>
    </form>
  );
}
