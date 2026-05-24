import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { sendPaymentLinkEmail } from "@/app/lib/server/resend";
import { InvoiceData } from "@/app/lib/invoice";

type Body = InvoiceData & { recipient_email?: string };

function validate(body: unknown): Body | string {
  if (!body || typeof body !== "object") return "Invalid body";
  const b = body as Record<string, unknown>;
  const requiredStrings = [
    "invoice_number",
    "client_name",
    "client_email",
    "currency",
    "due_date",
    "issued_at",
  ];
  for (const k of requiredStrings) {
    if (typeof b[k] !== "string" || !(b[k] as string).trim()) {
      return `Missing field: ${k}`;
    }
  }
  if (typeof b.amount !== "number" || !(b.amount > 0)) {
    return "amount must be a positive number";
  }
  if ((b.currency as string).length !== 3) {
    return "currency must be a 3-letter code";
  }
  if (typeof b.description !== "string") b.description = "";
  if (b.recipient_email != null && typeof b.recipient_email !== "string") {
    return "recipient_email must be a string";
  }
  if (b.payment_method == null) {
    b.payment_method = "STRIPE";
  } else if (b.payment_method !== "STRIPE" && b.payment_method !== "BANK_TRANSFER") {
    return "payment_method must be STRIPE or BANK_TRANSFER";
  }
  return b as unknown as Body;
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(json);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }
  const body = parsed;

  const supabase = getSupabaseAdmin();

  const { data: inserted, error: insertErr } = await supabase
    .from("invoices")
    .insert({
      invoice_no: body.invoice_number,
      client_name: body.client_name,
      client_email: body.client_email,
      amount: body.amount,
      currency: body.currency.toUpperCase(),
      due_date: body.due_date,
      payment_method: body.payment_method,
      status: body.payment_method === "BANK_TRANSFER" ? "AWAITING_TRANSFER" : "PENDING",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("[invoices] insert failed", insertErr);
    return NextResponse.json(
      { error: "Failed to save invoice" },
      { status: 500 },
    );
  }
  const invoiceId = inserted.id as string;

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const payUrl = `${baseUrl}/invoices/${invoiceId}/pay`;

  const { error: updateErr } = await supabase
    .from("invoices")
    .update({ payment_link: payUrl })
    .eq("id", invoiceId);

  if (updateErr) {
    console.error("[invoices] update with pay link failed", updateErr);
  }

  try {
    await sendPaymentLinkEmail({
      intendedRecipient: body.recipient_email || body.client_email,
      invoice: body,
      paymentUrl: payUrl,
    });
  } catch (e) {
    console.error("[invoices] resend failed", e);
    return NextResponse.json(
      {
        id: invoiceId,
        payment_link: payUrl,
        warning: "Invoice created but email failed to send",
      },
      { status: 207 },
    );
  }

  return NextResponse.json({ id: invoiceId, payment_link: payUrl });
}
