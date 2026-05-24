"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProofUploadForm({
  invoiceId,
  allowSkip = true,
}: {
  invoiceId: string;
  allowSkip?: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please choose a file.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/invoices/${invoiceId}/proof`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Upload failed");
      }
      router.push(`/invoices/${invoiceId}?reconciling=1`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setSubmitting(false);
    }
  }

  async function onSkip() {
    setSkipping(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/skip-proof`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Skip failed");
      }
      router.push(`/invoices/${invoiceId}?reconciling=1`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Skip failed");
      setSkipping(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        disabled={submitting}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-zinc-700 dark:file:bg-zinc-50 dark:file:text-black dark:hover:file:bg-zinc-300"
      />
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!file || submitting || skipping}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
        >
          {submitting ? "Uploading…" : "Upload proof"}
        </button>
        {allowSkip ? (
          <button
            type="button"
            onClick={onSkip}
            disabled={submitting || skipping}
            className="text-sm text-zinc-600 underline-offset-2 hover:underline hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {skipping ? "Skipping…" : "Skip for now →"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
