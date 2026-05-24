"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload, FileImage } from "lucide-react";
import { Pipeline, usePipelineSim } from "./Pipeline";
import { clsx } from "./ui/primitives";

export function ProofUploadForm({
  invoiceId,
  allowSkip = true,
}: {
  invoiceId: string;
  allowSkip?: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(f: File) {
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`/api/invoices/${invoiceId}/proof`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Upload failed");
      }
      router.push(`/invoices/${invoiceId}/done`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setSubmitting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please choose a file."); return; }
    await upload(file);
  }

  async function onSkip() {
    setSkipping(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/skip-proof`, { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Skip failed");
      }
      router.push(`/invoices/${invoiceId}/done`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Skip failed");
      setSkipping(false);
    }
  }

  if (submitting) {
    return <ProofUploadingState />;
  }

  return (
    <form onSubmit={onSubmit} className="cl-stack-4">
      <label
        className={clsx("cl-drop", dragging && "is-over")}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
      >
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ display: "none" }}
        />
        <div className="cl-drop-icon">
          {file ? <FileImage size={22} /> : <Upload size={22} />}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--cl-fg)" }}>
          {file ? file.name : "Drop a screenshot or PDF here"}
        </div>
        <div className="cl-subtle" style={{ fontSize: 11.5, marginTop: 4 }}>
          {file ? `${(file.size / 1024).toFixed(1)} KB` : "or click to browse · max 10MB"}
        </div>
      </label>

      {error ? <div className="cl-pill is-rose">{error}</div> : null}

      <div className="cl-row-between">
        {allowSkip ? (
          <button type="button" onClick={onSkip} disabled={skipping || submitting} className="cl-btn is-ghost">
            {skipping ? "Skipping…" : "Skip for now"}
          </button>
        ) : <span />}
        <button type="submit" disabled={!file || submitting || skipping} className="cl-btn is-primary">
          <Upload size={13} /> Upload proof
        </button>
      </div>
    </form>
  );
}

function ProofUploadingState() {
  const stages = usePipelineSim({ msPerStage: 900 });
  return (
    <div className="cl-stack-4 cl-fade-in">
      <div className="cl-drop" style={{ padding: 28 }}>
        <span className="cl-spin" style={{ color: "var(--cl-primary-400)" }} />
        <div style={{ marginTop: 12, fontSize: 13.5, fontWeight: 500 }}>Uploading & extracting…</div>
        <div className="cl-subtle" style={{ fontSize: 11.5, marginTop: 4 }}>Our agents are reading the receipt.</div>
      </div>
      <Pipeline stages={stages} compact />
    </div>
  );
}
