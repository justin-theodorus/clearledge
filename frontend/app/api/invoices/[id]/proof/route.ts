import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { triggerOrchestrator } from "@/app/lib/server/orchestrator";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = /^(image\/.+|application\/pdf)$/;

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "proof";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr) {
    console.error("[proof] invoice lookup failed", invErr);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  }
  if (!ALLOWED.test(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 415 },
    );
  }

  const path = `${invoiceId}/${Date.now()}-${sanitize(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("proofs")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error("[proof] storage upload failed", upErr);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const proofUrl = supabase.storage.from("proofs").getPublicUrl(path).data
    .publicUrl;

  const { data: row, error: insErr } = await supabase
    .from("proofs")
    .insert({ invoice_id: invoiceId, proof_url: proofUrl })
    .select("id")
    .single();
  if (insErr || !row) {
    console.error("[proof] db insert failed", insErr);
    return NextResponse.json({ error: "Failed to save proof" }, { status: 500 });
  }

  triggerOrchestrator(invoiceId);

  return NextResponse.json({ id: row.id, proof_url: proofUrl });
}
