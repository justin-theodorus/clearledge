import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGmailScope, getGoogleOAuthClient } from "@/app/lib/server/google";
import { saveRefreshToken } from "@/app/lib/server/gmailTokens";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin;

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(
      `${baseUrl}/settings?gmail=error&reason=${encodeURIComponent(oauthError)}`,
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings?gmail=error&reason=no_code`);
  }

  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    // happens when the user has previously consented; force re-consent on retry.
    return NextResponse.redirect(
      `${baseUrl}/settings?gmail=error&reason=no_refresh_token`,
    );
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const userInfo = await oauth2.userinfo.get();
  const googleEmail = userInfo.data.email;
  if (!googleEmail) {
    return NextResponse.redirect(
      `${baseUrl}/settings?gmail=error&reason=no_email`,
    );
  }

  await saveRefreshToken({
    googleEmail,
    refreshToken: tokens.refresh_token,
    scope: tokens.scope ?? getGmailScope(),
  });

  return NextResponse.redirect(`${baseUrl}/settings?gmail=connected`);
}
