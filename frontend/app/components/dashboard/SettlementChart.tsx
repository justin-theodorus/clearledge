export type StackedDay = {
  date: string;
  reconciled: number;
  partial: number;
  unverified: number;
};

export function SettlementChart({ data }: { data: StackedDay[] }) {
  const width = 720;
  const height = 220;
  const padding = { top: 12, right: 8, bottom: 24, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = Math.max(
    1,
    ...data.map((d) => d.reconciled + d.partial + d.unverified),
  );
  const barW = innerW / data.length - 3;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }}>
      {data.map((d, i) => {
        const x = padding.left + i * (innerW / data.length);
        const total = d.reconciled + d.partial + d.unverified;
        const hTotal = (total / max) * innerH;
        const yBase = padding.top + innerH - hTotal;
        const hRec = (d.reconciled / max) * innerH;
        const hPar = (d.partial / max) * innerH;
        const hUnv = (d.unverified / max) * innerH;
        return (
          <g key={d.date}>
            {hUnv > 0 ? (
              <rect x={x} y={yBase} width={barW} height={hUnv} fill="var(--cl-rose)" opacity={0.75} rx={2} />
            ) : null}
            {hPar > 0 ? (
              <rect x={x} y={yBase + hUnv} width={barW} height={hPar} fill="var(--cl-amber)" opacity={0.85} rx={2} />
            ) : null}
            {hRec > 0 ? (
              <rect x={x} y={yBase + hUnv + hPar} width={barW} height={hRec} fill="var(--cl-emerald)" rx={2} />
            ) : null}
            {i % 5 === 0 ? (
              <text
                x={x + barW / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize={9}
                fill="var(--cl-fg-subtle)"
                fontFamily="var(--font-jetbrains)"
              >
                {d.date.slice(5)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
