"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent } from "react";
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Client name" htmlFor="client_name">
        <input
          id="client_name"
          name="client_name"
          type="text"
          required
          placeholder="Budi Corp"
          className={inputClass}
        />
      </Field>

      <Field label="Client email" htmlFor="client_email">
        <input
          id="client_email"
          name="client_email"
          type="email"
          required
          placeholder="finance@budicorp.com"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_140px]">
        <Field label="Amount" htmlFor="amount">
          <input
            id="amount"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="0.00"
            className={inputClass}
          />
        </Field>
        <Field label="Currency" htmlFor="currency">
          <select
            id="currency"
            name="currency"
            defaultValue="USD"
            className={inputClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Due date" htmlFor="due_date">
        <input
          id="due_date"
          name="due_date"
          type="date"
          required
          className={inputClass}
        />
      </Field>

      <Field label="Payment method" htmlFor="payment_method">
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-300 p-3 hover:border-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-50">
            <input
              type="radio"
              name="payment_method"
              value="STRIPE"
              defaultChecked
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium">Stripe checkout</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                Card, PayNow, GrabPay, FPX. Settles automatically.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-300 p-3 hover:border-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-50">
            <input
              type="radio"
              name="payment_method"
              value="BANK_TRANSFER"
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium">Bank transfer</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                Client transfers manually. Proof upload is mandatory and we
                cross-check your DBS &ldquo;received&rdquo; email.
              </span>
            </span>
          </label>
        </div>
      </Field>

      <Field label="Description (optional)" htmlFor="description">
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="What is this invoice for?"
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="mt-2 flex items-center justify-end gap-3">
        <Link
          href="/"
          className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
        >
          Create invoice
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-600 dark:focus:border-zinc-50 dark:focus:ring-zinc-50";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
