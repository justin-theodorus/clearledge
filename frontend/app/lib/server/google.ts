import "server-only";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

const GMAIL_SCOPE_URL = "https://www.googleapis.com/auth/gmail.readonly";
// openid + email let us read the connected account address via userinfo.
const SCOPES = [GMAIL_SCOPE_URL, "openid", "email"];

let cached: OAuth2Client | null = null;

export function getGoogleOAuthClient(): OAuth2Client {
  if (cached) return cached;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }
  cached = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${baseUrl}/api/gmail/callback`,
  );
  return cached;
}

export function getOAuthScopes(): string[] {
  return SCOPES;
}

export function getGmailScope(): string {
  return GMAIL_SCOPE_URL;
}
