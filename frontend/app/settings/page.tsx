import { loadRefreshToken } from "@/app/lib/server/gmailTokens";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ gmail?: string; reason?: string }>;

function maskAccount(num: string | undefined): string {
  if (!num) return "(not configured)";
  if (num.length <= 4) return num;
  return `••••${num.slice(-4)}`;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const token = await loadRefreshToken().catch(() => null);
  const connected = Boolean(token);
  const smeAccount = process.env.SME_ACCOUNT_NUMBER;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Connect the SME&apos;s Gmail to enable bank-transfer reconciliation.
        </p>
      </div>

      {params.gmail === "connected" ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Gmail connected.
        </div>
      ) : null}
      {params.gmail === "error" ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          Gmail connection failed: {params.reason ?? "unknown"}
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Gmail inbox</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          ClearLedge reads only DBS &ldquo;You&apos;ve received a transfer&rdquo;
          notifications (gmail.readonly scope) to confirm bank transfers.
        </p>
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium">
              {connected ? `Connected as ${token?.google_email}` : "Not connected"}
            </p>
            {connected ? (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Since {new Date(token!.connected_at).toLocaleString()}
              </p>
            ) : null}
          </div>
          <a
            href="/api/gmail/connect"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
          >
            {connected ? "Reconnect" : "Connect Gmail"}
          </a>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">SME bank account</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Configured via the <code>SME_ACCOUNT_NUMBER</code> env var. Only the
          last four digits are shown here; the full number is displayed to
          clients on bank-transfer invoices.
        </p>
        <p className="mt-3 font-mono text-sm">{maskAccount(smeAccount)}</p>
      </section>
    </div>
  );
}
