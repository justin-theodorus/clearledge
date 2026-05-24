import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/app/lib/server/stripe";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { fetchFxRate } from "@/app/lib/server/fx";
import { REGIONS, isRegionCode } from "@/app/lib/regions";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const region = (body as { region?: unknown })?.region;
  if (!isRegionCode(region)) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, invoice_no, client_email, amount, currency, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[checkout] invoice fetch failed", fetchErr);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const config = REGIONS[region];
  const presentment = config.currency;
  const invoiceCurrency = String(invoice.currency).toUpperCase();
  const invoiceAmount = Number(invoice.amount);

  let unitAmount: number;
  if (invoiceCurrency === presentment) {
    unitAmount = Math.round(invoiceAmount * 100);
  } else {
    const fx = await fetchFxRate(invoiceCurrency, presentment, new Date());
    if (!fx) {
      return NextResponse.json(
        { error: `FX rate unavailable for ${invoiceCurrency}->${presentment}` },
        { status: 502 },
      );
    }
    unitAmount = Math.round(invoiceAmount * fx.rate * 100);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const stripe = getStripe();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: [...config.methods],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: presentment.toLowerCase(),
            unit_amount: unitAmount,
            product_data: {
              name: `Invoice ${invoice.invoice_no}`,
            },
          },
        },
      ],
      customer_email: invoice.client_email,
      success_url: `${baseUrl}/invoices/${invoiceId}/proof?paid=1`,
      cancel_url: `${baseUrl}/invoices/${invoiceId}/pay`,
      metadata: {
        invoice_id: invoiceId,
        invoice_no: invoice.invoice_no,
        region,
      },
    });
  } catch (e) {
    console.error("[checkout] stripe session failed", e);
    return NextResponse.json(
      { error: "Failed to create payment session" },
      { status: 502 },
    );
  }

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe returned no URL" },
      { status: 502 },
    );
  }

  const { error: updErr } = await supabase
    .from("invoices")
    .update({ stripe_session_id: session.id })
    .eq("id", invoiceId);
  if (updErr) {
    console.error("[checkout] invoice stripe_session_id update failed", updErr);
  }

  return NextResponse.json({ url: session.url });
}
