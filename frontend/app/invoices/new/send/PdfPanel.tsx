"use client";

import { BlobProvider } from "@react-pdf/renderer";
import { InvoicePdf } from "@/app/components/InvoicePdf";
import { InvoiceData } from "@/app/lib/invoice";

export function PdfPanel({ data }: { data: InvoiceData }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <BlobProvider document={<InvoicePdf data={data} />}>
        {({ url, loading, error }) => (
          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <p className="text-sm font-medium">Invoice preview</p>
              {url ? (
                <a
                  href={url}
                  download={`${data.invoice_number}.pdf`}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Download PDF
                </a>
              ) : (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {error ? "Failed to render" : "Rendering…"}
                </span>
              )}
            </div>
            <div className="h-[720px] bg-zinc-50 dark:bg-zinc-900">
              {loading || !url ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                  {error ? "Could not render PDF." : "Rendering preview…"}
                </div>
              ) : (
                <iframe
                  src={url}
                  title={`Invoice ${data.invoice_number}`}
                  className="h-full w-full"
                />
              )}
            </div>
          </div>
        )}
      </BlobProvider>
    </div>
  );
}
