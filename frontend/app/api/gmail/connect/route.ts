import { NextResponse } from "next/server";
import { getOAuthScopes, getGoogleOAuthClient } from "@/app/lib/server/google";
import { requireAdminApi } from "@/app/lib/server/supabaseAuth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const client = getGoogleOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: getOAuthScopes(),
    include_granted_scopes: true,
  });
  return NextResponse.redirect(url);
}
