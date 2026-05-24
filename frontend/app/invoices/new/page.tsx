import { InvoiceForm } from "@/app/components/InvoiceForm";
import { requireAdmin } from "@/app/lib/server/supabaseAuth";
import { clsx } from "@/app/components/ui/primitives";

const STEPS = ["Client & amount", "Settlement", "Review", "Send"];

export default async function NewInvoicePage() {
  await requireAdmin();
  return (
    <>
      <div className="cl-page-head">
        <div className="cl-page-title">
          <h1 className="cl-h1">New invoice</h1>
          <p>Issue an invoice and generate a payment link for your client.</p>
        </div>
      </div>

      <div className="cl-stepper">
        {STEPS.map((s, i) => (
          <span key={s} className="cl-row-gap" style={{ alignItems: "center" }}>
            <span className={clsx("cl-step", i === 0 && "is-active")}>
              <span className="cl-step-no">{i + 1}</span>
              <span>{s}</span>
            </span>
            {i < STEPS.length - 1 ? <span className="cl-step-line" /> : null}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 18, maxWidth: 600 }}>
        <div className="cl-card cl-card-pad">
          <InvoiceForm />
        </div>
      </div>
    </>
  );
}
