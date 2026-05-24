import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { requireAdmin } from "@/app/lib/server/supabaseAuth";
import { AuditTable, AuditTableRow } from "@/app/components/AuditTable";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("audit_logs")
    .select("id,invoice_id,status,confidence,summary,created_at,invoices(invoice_no,client_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const entries = (data ?? []) as unknown as AuditTableRow[];

  return (
    <>
      <div className="cl-page-head">
        <div className="cl-page-title">
          <h1 className="cl-h1">Audit log</h1>
          <p>Append-only history of every reconciliation decision.</p>
        </div>
      </div>
      <AuditTable entries={entries} />
    </>
  );
}
