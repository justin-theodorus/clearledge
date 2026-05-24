import { NextResponse } from "next/server";
import { getOAuthScopes, getGoogleOAuthClient } from "@/app/lib/server/google";

export const runtime = "nodejs";

export async function GET() {
  const client = getGoogleOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: getOAuthScopes(),
    include_granted_scopes: true,
  });
  return NextResponse.redirect(url);
}
