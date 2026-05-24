import "server-only";

type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

export async function fetchFxRate(
  from: string,
  to: string,
  at: Date,
): Promise<{ rate: number; date: string } | null> {
  if (from.toUpperCase() === to.toUpperCase()) {
    return { rate: 1, date: at.toISOString().slice(0, 10) };
  }
  const day = at.toISOString().slice(0, 10);
  const url = `https://api.frankfurter.dev/v1/${day}?base=${from.toUpperCase()}&symbols=${to.toUpperCase()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as FrankfurterResponse;
    const rate = json.rates?.[to.toUpperCase()];
    if (typeof rate !== "number") return null;
    return { rate, date: json.date };
  } catch (e) {
    console.error("[fx] frankfurter failed", e);
    return null;
  }
}
