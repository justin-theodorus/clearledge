import "server-only";
import { Resend } from "resend";
import { InvoiceData, formatDate, formatMoney } from "@/app/lib/invoice";

let cached: Resend | null = null;

function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  cached = new Resend(key);
  return cached;
}

type SendArgs = {
  intendedRecipient: string;
  invoice: InvoiceData;
  paymentUrl: string;
};

export async function sendPaymentLinkEmail({
  intendedRecipient,
  invoice,
  paymentUrl,
}: SendArgs): Promise<{ id: string | null }> {
  const sandboxTo = process.env.RESEND_SIGNUP_EMAIL;
  if (!sandboxTo) throw new Error("Missing RESEND_SIGNUP_EMAIL");

  console.log(
    `[resend] sandbox: routing email intended for ${intendedRecipient} to ${sandboxTo}`,
  );

  const amount = formatMoney(invoice.amount, invoice.currency);
  const due = formatDate(invoice.due_date);
  const isBankTransfer = invoice.payment_method === "BANK_TRANSFER";

  const intro = isBankTransfer
    ? "You have a new invoice from ClearLedge. Please pay by bank transfer and upload your proof of payment on the link below."
    : "You have a new invoice from ClearLedge.";
  const ctaLabel = isBankTransfer ? "View bank details" : "Pay invoice";

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b">
    <h1 style="font-size:20px;margin:0 0 16px">Invoice ${invoice.invoice_number}</h1>
    <p style="margin:0 0 8px">Hi ${invoice.client_name},</p>
    <p style="margin:0 0 16px">${intro}</p>
    <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">Amount</td><td style="font-weight:600">${amount}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">Due</td><td>${due}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">For</td><td>${invoice.description ?? ""}</td></tr>
    </table>
    <p style="margin:24px 0">
      <a href="${paymentUrl}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:500">${ctaLabel}</a>
    </p>
    <p style="font-size:12px;color:#71717a;word-break:break-all">Or paste this link: ${paymentUrl}</p>
    <p style="font-size:12px;color:#a1a1aa;margin-top:32px">(Sandbox: this message was intended for ${intendedRecipient}.)</p>
  </div>`;

  const result = await getResend().emails.send({
    from: "ClearLedge <onboarding@resend.dev>",
    to: sandboxTo,
    subject: `Invoice ${invoice.invoice_number} — ${amount}`,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
  return { id: result.data?.id ?? null };
}
