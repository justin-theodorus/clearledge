import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { requireAdminApi } from "@/app/lib/server/supabaseAuth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const [invoiceRes, proofRes, txnRes, auditRes] = await Promise.all([
    supabase.from("invoices").select("status").eq("id", id).maybeSingle(),
    supabase.from("proofs").select("id", { count: "exact", head: true }).eq("invoice_id", id),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("invoice_id", id),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("invoice_id", id),
  ]);

  return NextResponse.json({
    invoiceStatus: invoiceRes.data?.status ?? null,
    hasProof: (proofRes.count ?? 0) > 0,
    hasTxn: (txnRes.count ?? 0) > 0,
    auditCount: auditRes.count ?? 0,
  });
}
