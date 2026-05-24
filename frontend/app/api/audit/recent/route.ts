import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { requireAdmin } from "@/app/lib/server/supabaseAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,invoice_id,status,confidence,summary,created_at,invoices(invoice_no,client_name)")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) return NextResponse.json({ entries: [] });
  type Row = {
    id: string;
    invoice_id: string;
    status: string;
    confidence: number;
    summary: string;
    created_at: string;
    invoices: { invoice_no: string; client_name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const entries = rows.map((a) => ({
    id: a.id,
    invoiceId: a.invoice_id,
    invoiceNo: a.invoices?.invoice_no ?? a.invoice_id.slice(0, 8),
    client: a.invoices?.client_name ?? "—",
    status: a.status,
    confidence: Number(a.confidence),
    summary: a.summary,
    createdAt: a.created_at,
  }));
  return NextResponse.json({ entries });
}
