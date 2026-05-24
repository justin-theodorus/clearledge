import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { triggerOrchestrator } from "@/app/lib/server/orchestrator";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) {
    console.error("[skip-proof] invoice lookup failed", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  triggerOrchestrator(invoiceId);
  return NextResponse.json({ dispatched: true });
}
