import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/app/lib/server/stripe";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";

export const runtime = "nodejs";

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = getSupabaseAdmin();
  const invoiceId = session.metadata?.invoice_id;
  if (!invoiceId) {
    console.error("[webhook] no invoice_id in session metadata", session.id);
    return;
  }

  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .single();

  if (fetchErr || !invoice) {
    console.error("[webhook] invoice not found", invoiceId, fetchErr);
    return;
  }

  const piId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!piId) {
    console.error("[webhook] no payment_intent on session", session.id);
    return;
  }

  const stripe = getStripe();
  let amountReceived: number;
  let currencyReceived: string;
  let fxRate: number | null = null;
  let fxTimestamp: string | null = null;
  let paidAt = new Date();

  try {
    const pi = await stripe.paymentIntents.retrieve(piId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = pi.latest_charge as Stripe.Charge | null;
    const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
    if (!bt) {
      console.error(
        "[webhook] missing balance_transaction; falling back to session amounts",
        session.id,
      );
      amountReceived = (session.amount_total ?? 0) / 100;
      currencyReceived = (session.currency ?? "").toUpperCase();
    } else {
      amountReceived = bt.amount / 100;
      currencyReceived = bt.currency.toUpperCase();
      fxRate = typeof bt.exchange_rate === "number" ? bt.exchange_rate : null;
      fxTimestamp = new Date(bt.created * 1000).toISOString();
      paidAt = new Date(bt.created * 1000);
    }
  } catch (e) {
    console.error("[webhook] payment_intent retrieve failed", e);
    amountReceived = (session.amount_total ?? 0) / 100;
    currencyReceived = (session.currency ?? "").toUpperCase();
  }

  const { error: txErr } = await supabase.from("transactions").insert({
    invoice_id: invoice.id,
    amount_received: amountReceived,
    currency_received: currencyReceived,
    fx_rate: fxRate,
    fx_timestamp: fxTimestamp,
    stripe_payment_intent: piId,
    paid_at: paidAt.toISOString(),
  });

  if (txErr) {
    console.error("[webhook] transaction insert failed", txErr);
    return;
  }

  const { error: updErr } = await supabase
    .from("invoices")
    .update({ status: "PAID" })
    .eq("id", invoice.id);

  if (updErr) {
    console.error("[webhook] invoice status update failed", updErr);
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (e) {
    console.error("[webhook] signature verification failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      console.warn(
        "[webhook] checkout.session.expired",
        s.id,
        "invoice_id=",
        s.metadata?.invoice_id,
      );
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      console.warn(
        "[webhook] payment_intent.payment_failed",
        pi.id,
        "reason=",
        pi.last_payment_error?.message ?? "unknown",
      );
      break;
    }
  }

  return NextResponse.json({ received: true });
}
