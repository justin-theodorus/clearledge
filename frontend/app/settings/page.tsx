import { Mail, CreditCard, Database, Send } from "lucide-react";
import { loadRefreshToken } from "@/app/lib/server/gmailTokens";
import { requireAdmin, getCurrentUser } from "@/app/lib/server/supabaseAuth";
import { REGIONS, RegionCode } from "@/app/lib/regions";
import { Flag } from "@/app/components/ui/primitives";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ gmail?: string; reason?: string }>;

function maskAccount(num: string | undefined): string {
  if (!num) return "(not configured)";
  if (num.length <= 4) return num;
  return `••••${num.slice(-4)}`;
}

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const user = await getCurrentUser();
  const params = await searchParams;
  const token = await loadRefreshToken().catch(() => null);
  const connected = Boolean(token);
  const smeAccount = process.env.SME_ACCOUNT_NUMBER;
  const smeBank = process.env.SME_BANK_NAME ?? "DBS Bank";
  const smeCurrency = process.env.SME_ACCOUNT_CURRENCY ?? "SGD";

  return (
    <>
      <div className="cl-page-head">
        <div className="cl-page-title">
          <h1 className="cl-h1">Settings</h1>
          <p>Integrations, regional defaults, and your profile.</p>
        </div>
      </div>

      {params.gmail === "connected" ? (
        <div className="cl-pill is-emerald" style={{ marginBottom: 16 }}>Gmail connected.</div>
      ) : null}
      {params.gmail === "error" ? (
        <div className="cl-pill is-rose" style={{ marginBottom: 16 }}>Gmail connection failed: {params.reason ?? "unknown"}</div>
      ) : null}

      <div className="cl-stack-5" style={{ maxWidth: 900 }}>
        {/* Profile */}
        <section className="cl-card">
          <div className="cl-card-head"><h2>Profile</h2></div>
          <div className="cl-card-pad cl-stack-3">
            <Row label="Email" value={user?.email ?? "—"} />
            <Row label="Role" value="Admin" />
          </div>
        </section>

        {/* Integrations */}
        <section className="cl-card">
          <div className="cl-card-head"><h2>Integrations</h2></div>
          <IntegrationRow
            icon={<Mail size={16} color="var(--cl-primary-400)" />}
            name="Gmail"
            description={connected ? `Connected as ${token?.google_email}` : "Reads DBS payment notification emails for bank transfers."}
            action={
              <a href="/api/gmail/connect" className="cl-btn is-sm">
                {connected ? "Reconnect" : "Connect"}
              </a>
            }
            tone={connected ? "emerald" : "slate"}
          />
          <IntegrationRow
            icon={<CreditCard size={16} color="var(--cl-primary-400)" />}
            name="Stripe"
            description="Checkout sessions, webhook ingestion, FX-aware settlement."
            action={<span className="cl-pill is-emerald">Connected</span>}
            tone="emerald"
          />
          <IntegrationRow
            icon={<Send size={16} color="var(--cl-primary-400)" />}
            name="Resend"
            description="Outbound payment-link emails (sandbox)."
            action={<span className="cl-pill is-emerald">Connected</span>}
            tone="emerald"
          />
          <IntegrationRow
            icon={<Database size={16} color="var(--cl-primary-400)" />}
            name="Supabase"
            description="Ledger storage, proof bucket, auth."
            action={<span className="cl-pill is-emerald">Connected</span>}
            tone="emerald"
          />
        </section>

        {/* Settlement bank */}
        <section className="cl-card">
          <div className="cl-card-head"><h2>Settlement bank</h2></div>
          <div className="cl-card-pad cl-stack-3">
            <Row label="Bank" value={smeBank} />
            <Row label="Account" value={maskAccount(smeAccount)} mono />
            <Row label="Currency" value={smeCurrency} />
            <p className="cl-subtle" style={{ fontSize: 11, margin: 0 }}>
              Configured via <span className="cl-mono">SME_ACCOUNT_NUMBER</span> env var. The full number is shown to clients on bank-transfer invoices.
            </p>
          </div>
        </section>

        {/* Regional defaults */}
        <section className="cl-card">
          <div className="cl-card-head"><h2>Regional defaults</h2></div>
          <div className="cl-table-wrap" style={{ border: 0, borderRadius: 0 }}>
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Currency</th>
                  <th>Accepted methods</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(REGIONS) as RegionCode[]).map((code) => (
                  <tr key={code}>
                    <td><span className="cl-row-gap"><Flag code={code} /> {REGIONS[code].label.replace(/^\S+\s/, "")}</span></td>
                    <td className="cl-mono">{REGIONS[code].currency}</td>
                    <td className="cl-subtle" style={{ fontSize: 12 }}>{REGIONS[code].methods.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="cl-row-between">
      <span className="cl-h3" style={{ textTransform: "none" }}>{label}</span>
      <span className={mono ? "cl-mono" : ""} style={{ fontSize: 13 }}>{value}</span>
    </div>
  );
}

function IntegrationRow({
  icon, name, description, action, tone,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  action: React.ReactNode;
  tone: "emerald" | "slate";
}) {
  return (
    <div className="cl-card-row cl-row-between">
      <div className="cl-row-gap" style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--cl-surface-2)", border: "1px solid var(--cl-border)",
        }}>{icon}</div>
        <div className="cl-stack" style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{name}</span>
          <span className="cl-subtle" style={{ fontSize: 12 }}>{description}</span>
        </div>
      </div>
      <div className="cl-row-gap">
        {tone === "emerald" ? null : null}
        {action}
      </div>
    </div>
  );
}
