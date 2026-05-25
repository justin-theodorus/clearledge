import * as React from "react";

/* ─────────── helpers ─────────── */
export type Tone = "emerald" | "amber" | "rose" | "slate" | "sky" | "violet" | "primary";

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ─────────── Card ─────────── */
export function Card({
  className,
  children,
  pad = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { pad?: boolean }) {
  return (
    <div className={clsx("cl-card", pad && "cl-card-pad", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHead({
  title,
  action,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="cl-card-head">
      <h2>{title}</h2>
      {action ? <div className="cl-row-gap">{action}</div> : null}
    </div>
  );
}

/* ─────────── Button ─────────── */
type BtnVariant = "default" | "primary" | "ghost" | "danger";
type BtnSize = "sm" | "md" | "lg";

export function Button({
  variant = "default",
  size = "md",
  block = false,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  block?: boolean;
}) {
  return (
    <button
      className={clsx(
        "cl-btn",
        variant === "primary" && "is-primary",
        variant === "ghost" && "is-ghost",
        variant === "danger" && "is-danger",
        size === "sm" && "is-sm",
        size === "lg" && "is-lg",
        block && "is-block",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ─────────── Pill ─────────── */
export function Pill({
  tone = "slate",
  large,
  dot = true,
  children,
  className,
}: {
  tone?: Tone;
  large?: boolean;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === "primary" ? "is-violet" : `is-${tone}`;
  return (
    <span className={clsx("cl-pill", toneClass, large && "is-lg", className)}>
      {dot ? <span className="cl-pill-dot" /> : null}
      {children}
    </span>
  );
}

/* ─────────── Money ─────────── */
export function Money({
  amount,
  currency,
  className,
}: {
  amount: number;
  currency: string;
  className?: string;
}) {
  const sign = amount < 0 ? "−" : "";
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return (
    <span className={clsx("cl-mono", className)}>
      <span className="cl-subtle" style={{ fontSize: "0.78em", marginRight: 4 }}>
        {currency.toUpperCase()}
      </span>
      {sign}
      {formatted}
    </span>
  );
}

/* ─────────── Sparkline ─────────── */
export function Sparkline({
  data,
  width = 80,
  height = 28,
  color = "var(--cl-primary-400)",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M ${pts.join(" L ")}`;
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────── StatCard ─────────── */
export function StatCard({
  label,
  value,
  currency,
  delta,
  deltaLabel,
  spark,
}: {
  label: string;
  value: string;
  currency?: string;
  delta?: number;
  deltaLabel?: string;
  spark?: number[];
}) {
  return (
    <div className="cl-stat">
      <div className="cl-stat-label">{label}</div>
      <div className="cl-stat-val">
        {currency ? <span className="cl-stat-curr">{currency}</span> : null}
        {value}
      </div>
      {(delta !== undefined || deltaLabel) && (
        <div className="cl-stat-foot">
          {delta !== undefined ? (
            <span className={delta >= 0 ? "cl-delta-up" : "cl-delta-down"}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
            </span>
          ) : null}
          {deltaLabel ? <span>{deltaLabel}</span> : null}
        </div>
      )}
      {spark ? (
        <div className="cl-stat-spark">
          <Sparkline data={spark} width={80} height={28} />
        </div>
      ) : null}
    </div>
  );
}

/* ─────────── RingMeter ─────────── */
export function RingMeter({
  value,
  size = 64,
  stroke = 6,
  pulsing = false,
}: {
  value: number;
  size?: number;
  stroke?: number;
  pulsing?: boolean;
}) {
  const v = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // While pulsing (pipeline running, no audit yet) animate an indeterminate
  // sweep instead of a 0% ring.
  const indeterminate = pulsing && v === 0;
  const offset = indeterminate ? c * 0.7 : c * (1 - v);
  const tone = pulsing
    ? "var(--cl-primary-400)"
    : v >= 0.85 ? "var(--cl-emerald)" : v >= 0.6 ? "var(--cl-amber)" : "var(--cl-rose)";
  return (
    <div style={{ position: "relative", width: size, height: size }} className={pulsing ? "cl-ring-pulse" : undefined}>
      <svg width={size} height={size} className={clsx("cl-ring", indeterminate && "cl-ring-spin")}>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="cl-ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="cl-ring-fg"
          stroke={tone}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
          fontVariantNumeric: "tabular-nums",
          fontSize: size < 56 ? 11 : 13,
          fontWeight: 600,
          color: "var(--cl-fg)",
        }}
      >
        {indeterminate ? "…" : v.toFixed(2)}
      </div>
    </div>
  );
}

/* ─────────── ConfBar ─────────── */
export function ConfBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  const tone = v >= 0.85 ? "is-emerald" : v >= 0.6 ? "is-amber" : v > 0 ? "is-rose" : "is-slate";
  return (
    <div className="cl-conf-bar" title={v.toFixed(3)}>
      <div className={clsx("cl-conf-fill", tone)} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

/* ─────────── Chip ─────────── */
export function Chip({
  active,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button type="button" className={clsx("cl-chip", active && "is-active")} {...rest}>
      {children}
    </button>
  );
}

/* ─────────── Flag (region) ─────────── */
export function Flag({ code }: { code: string }) {
  return <span className="cl-flag">{code}</span>;
}

/* ─────────── Conf pill ─────────── */
export function ConfPill({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="cl-conf-pill cl-subtle">—</span>;
  }
  return <span className="cl-conf-pill">{Number(value).toFixed(3)}</span>;
}
