import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/app/lib/server/stripe";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";

export const runtime = "nodejs";

type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

async function fetchFxRate(
  from: string,
  to: string,
  at: Date,
): Promise<{ rate: number; date: string } | null> {
  if (from.toUpperCase() === to.toUpperCase()) {
    return { rate: 1, date: at.toISOString().slice(0, 10) };
  }
  const day = at.toISOString().slice(0, 10);
  const url = `https://api.frankfurter.dev/v1/${day}?base=${from.toUpperCase()}&symbols=${to.toUpperCase()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as FrankfurterResponse;
    const rate = json.rates?.[to.toUpperCase()];
    if (typeof rate !== "number") return null;
    return { rate, date: json.date };
  } catch (e) {
    console.error("[webhook] frankfurter failed", e);
    return null;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = getSupabaseAdmin();
  const invoiceId = session.metadata?.invoice_id;
  if (!invoiceId) {
    console.error("[webhook] no invoice_id in session metadata", session.id);
    return;
  }

  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, currency, amount")
    .eq("id", invoiceId)
    .single();

  if (fetchErr || !invoice) {
    console.error("[webhook] invoice not found", invoiceId, fetchErr);
    return;
  }

  const amountReceivedMinor = session.amount_total ?? 0;
  const currencyReceived = (session.currency ?? invoice.currency).toUpperCase();
  const amountReceived = amountReceivedMinor / 100;
  const paidAt = new Date();

  const fx = await fetchFxRate(currencyReceived, invoice.currency, paidAt);
  const amountConverted = fx ? +(amountReceived * fx.rate).toFixed(2) : null;

  const { error: txErr } = await supabase.from("transactions").insert({
    invoice_id: invoice.id,
    amount_received: amountReceived,
    currency_received: currencyReceived,
    amount_converted: amountConverted,
    fx_rate: fx?.rate ?? null,
    fx_timestamp: fx ? new Date(`${fx.date}T00:00:00Z`).toISOString() : null,
    stripe_payment_intent:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
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
