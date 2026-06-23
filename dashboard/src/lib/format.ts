export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
}

export function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

/** Compact USD for large values: $19.4M, $1.2B. */
export function formatUsdCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${formatCompact(n)}`;
}

/** Price-style USD with cents ($431.20); compacts above 1e6 to stay short. */
export function formatUsdPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e6) return `$${formatCompact(n)}`;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
