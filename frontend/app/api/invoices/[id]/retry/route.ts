import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";
import { requireAdminApi } from "@/app/lib/server/supabaseAuth";
import { triggerOrchestrator } from "@/app/lib/server/orchestrator";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("invoices")
    .select("id,payment_method")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[retry] invoice lookup failed", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  triggerOrchestrator(id, {
    retryOnce: data.payment_method === "BANK_TRANSFER",
  });
  return NextResponse.json({ ok: true });
}
