import "server-only";
import { getSupabaseAdmin } from "@/app/lib/server/supabase";

const DEFAULT_SME = "default";

function getKey(): string {
  const key = process.env.GMAIL_TOKEN_KEY;
  if (!key) throw new Error("Missing GMAIL_TOKEN_KEY");
  return key;
}

export async function saveRefreshToken(args: {
  googleEmail: string;
  refreshToken: string;
  scope: string;
  smeId?: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("gmail_token_set", {
    p_sme_id: args.smeId ?? DEFAULT_SME,
    p_google_email: args.googleEmail,
    p_refresh_token: args.refreshToken,
    p_scope: args.scope,
    p_key: getKey(),
  });
  if (error) throw new Error(`gmail_token_set failed: ${error.message}`);
}

export type GmailTokenRow = {
  google_email: string;
  refresh_token: string;
  scope: string;
  connected_at: string;
};

export async function loadRefreshToken(
  smeId: string = DEFAULT_SME,
): Promise<GmailTokenRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("gmail_token_get", {
    p_sme_id: smeId,
    p_key: getKey(),
  });
  if (error) throw new Error(`gmail_token_get failed: ${error.message}`);
  const rows = (data ?? []) as GmailTokenRow[];
  return rows[0] ?? null;
}
