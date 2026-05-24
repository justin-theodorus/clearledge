import { Check } from "lucide-react";
import { LoginForm } from "./LoginForm";
import { Pill, RingMeter } from "@/app/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="cl-auth-wrap">
      <div className="cl-auth-form">
        <div className="cl-auth-card">
          <div className="cl-row-gap" style={{ marginBottom: 6 }}>
            <span className="cl-brand-mark">CL</span>
            <span style={{ fontWeight: 600, fontSize: 16 }}>ClearLedge</span>
          </div>
          <div>
            <h1 className="cl-h1" style={{ fontSize: 22 }}>Welcome back</h1>
            <p className="cl-sub" style={{ marginTop: 4 }}>
              Sign in to manage invoices and view the reconciliation dashboard.
            </p>
          </div>
          <LoginForm next={next ?? "/"} />
          <p className="cl-subtle" style={{ fontSize: 11, textAlign: "center" }}>
            Need access? Ask an admin to invite you.
          </p>
        </div>
      </div>

      <div className="cl-auth-stage">
        <div className="cl-stack-4" style={{ width: 380, maxWidth: "100%" }}>
          <div className="cl-card cl-card-pad cl-fade-in">
            <div className="cl-row-between" style={{ marginBottom: 12 }}>
              <span className="cl-mono" style={{ fontSize: 12 }}>INV-20260524-3041</span>
              <Pill tone="emerald">RECONCILED</Pill>
            </div>
            <div className="cl-row-gap" style={{ gap: 16 }}>
              <RingMeter value={0.93} size={56} stroke={5} />
              <div className="cl-stack-2">
                <span className="cl-h3" style={{ textTransform: "none" }}>Match confidence</span>
                <span className="cl-subtle" style={{ fontSize: 11.5 }}>Sender + amount + FX rate all aligned.</span>
              </div>
            </div>
          </div>
          <div className="cl-card cl-card-pad cl-fade-in">
            <div className="cl-h3" style={{ marginBottom: 8 }}>This week</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <Stat label="Reconciled" value="42" />
              <Stat label="Pending" value="6" />
              <Stat label="FX exposure" value="$12.4k" />
            </div>
          </div>
          <div className="cl-card cl-card-pad cl-fade-in">
            <div className="cl-stack-3" style={{ fontSize: 12.5 }}>
              <Tick>FX-aware reconciliation</Tick>
              <Tick>Gmail bank-receipt verification</Tick>
              <Tick>Multi-region payment methods</Tick>
              <Tick>Append-only audit log</Tick>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="cl-h3" style={{ textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div className="cl-mono" style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <div className="cl-row-gap">
      <span style={{ width: 16, height: 16, borderRadius: 999, background: "var(--cl-emerald-bg)", color: "var(--cl-emerald)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Check size={11} />
      </span>
      <span>{children}</span>
    </div>
  );
}
