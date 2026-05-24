import { Plus } from "lucide-react";
import Link from "next/link";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { requireAdmin } from "@/app/lib/server/supabaseAuth";
import { InvoicesTable } from "@/app/components/invoices/InvoicesTable";

export const dynamic = "force-dynamic";

export default async function InvoicesListPage() {
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const [invRes, auditRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id,invoice_no,client_name,client_email,amount,currency,status,created_at,due_date,payment_method")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("audit_logs")
      .select("invoice_id,confidence,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const invoices = invRes.data ?? [];
  const confByInvoice = new Map<string, number>();
  for (const a of (auditRes.data ?? []) as { invoice_id: string; confidence: number }[]) {
    if (!confByInvoice.has(a.invoice_id)) confByInvoice.set(a.invoice_id, Number(a.confidence));
  }

  const rows = invoices.map((i) => ({
    ...i,
    confidence: confByInvoice.get(i.id) ?? null,
  }));

  return (
    <>
      <div className="cl-page-head">
        <div className="cl-page-title">
          <h1 className="cl-h1">Invoices</h1>
          <p>
            {invoices.length} total · use <span className="cl-keyhint">j</span>{" "}
            <span className="cl-keyhint">k</span> to navigate,{" "}
            <span className="cl-keyhint">↵</span> to open
          </p>
        </div>
        <div className="cl-page-actions">
          <Link href="/invoices/new" className="cl-btn is-primary">
            <Plus size={14} />
            New invoice
          </Link>
        </div>
      </div>

      <InvoicesTable rows={rows} />
    </>
  );
}
