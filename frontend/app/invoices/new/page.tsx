import { InvoiceForm } from "@/app/components/InvoiceForm";

export default function NewInvoicePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Issue an invoice and generate a payment link for your client.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <InvoiceForm />
      </div>
    </div>
  );
}
