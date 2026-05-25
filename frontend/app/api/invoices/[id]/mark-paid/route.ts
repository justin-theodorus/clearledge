import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { requireAdminApi } from "@/app/lib/server/supabaseAuth";
import { triggerOrchestrator } from "@/app/lib/server/orchestrator";

export const runtime = "nodejs";

type Body = {
  amount_received?: unknown;
  currency_received?: unknown;
  paid_at?: unknown;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id: invoiceId } = await params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amount = typeof body.amount_received === "number"
    ? body.amount_received
    : Number(body.amount_received);
  const currencyRaw = typeof body.currency_received === "string"
    ? body.currency_received.trim().toUpperCase()
    : "";
  const paidAtRaw = typeof body.paid_at === "string" ? body.paid_at : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount_received must be > 0" }, { status: 400 });
  }
  if (!/^[A-Z]{3}$/.test(currencyRaw)) {
    return NextResponse.json({ error: "currency_received must be a 3-letter code" }, { status: 400 });
  }
  const paidAt = new Date(paidAtRaw);
  if (Number.isNaN(paidAt.getTime())) {
    return NextResponse.json({ error: "paid_at must be a valid date" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id,status,payment_method")
    .eq("id", invoiceId)
    .maybeSingle();
  if (fetchErr) {
    console.error("[mark-paid] invoice lookup failed", fetchErr);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.payment_method !== "BANK_TRANSFER") {
    return NextResponse.json(
      { error: "Manual entry only available for bank-transfer invoices" },
      { status: 409 },
    );
  }
  if (invoice.status === "PAID" || invoice.status === "RECONCILED") {
    return NextResponse.json(
      { error: "Invoice is already settled" },
      { status: 409 },
    );
  }

  const provenance = `manual:${auth.user.id}:${Date.now()}`;
  const { error: txErr } = await supabase.from("transactions").insert({
    invoice_id: invoice.id,
    amount_received: amount,
    currency_received: currencyRaw,
    fx_rate: null,
    fx_timestamp: null,
    stripe_payment_intent: provenance,
    paid_at: paidAt.toISOString(),
  });
  if (txErr) {
    console.error("[mark-paid] transaction insert failed", txErr);
    return NextResponse.json({ error: "Failed to record transaction" }, { status: 500 });
  }

  const { error: updErr } = await supabase
    .from("invoices")
    .update({ status: "PAID" })
    .eq("id", invoice.id);
  if (updErr) {
    console.error("[mark-paid] invoice status update failed", updErr);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }

  triggerOrchestrator(invoice.id);
  return NextResponse.json({ dispatched: true });
}
