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
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,status,confidence,summary,reasons,capped,signals,created_at")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[audit GET] fetch failed", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
  return NextResponse.json({ entries: data ?? [] });
}
