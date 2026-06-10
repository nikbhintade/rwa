import { useMemo, useState } from "react";
import { tokens } from "../data/tokens";
import { chainById } from "../data/chains";
import type { AssetClass, Token, TokenStats } from "../types";
import { assembleFromChainStats, type ChainStatsMap } from "../lib/gql";
import { formatCompact } from "../lib/format";
import { Sparkline } from "./Sparkline";

type SortKey = "transfer" | "supply";
type SortDir = "asc" | "desc";

// Only stablecoins are live; the rest are gated off ("Soon") for now.
const ASSET_CLASSES: { id: AssetClass; label: string; enabled: boolean }[] = [
  { id: "stablecoin", label: "Stablecoins", enabled: true },
  { id: "treasury", label: "US Treasuries", enabled: false },
  { id: "credit", label: "Tokenized Credit", enabled: false },
  { id: "stock", label: "Tokenized Stocks", enabled: false },
];

type Props = {
  selectedId?: string;
  onSelect?: (token: Token) => void;
  stats: ChainStatsMap;
  loading: boolean;
};

function transferSum(s: TokenStats): number {
  return s.days.reduce((a, d) => a + d.dailyTransferAmount, 0);
}

export function Sidebar({ selectedId, onSelect, stats, loading }: Props) {
  const [assetClass, setAssetClass] = useState<AssetClass>("stablecoin");
  const [sortKey, setSortKey] = useState<SortKey>("supply");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Aggregate each logical token across its chains from the per-chain map.
  const aggregated = useMemo(
    () => new Map(tokens.map((t) => [t.id, assembleFromChainStats(t, stats)])),
    [stats],
  );

  const rows = useMemo(() => {
    const filtered = tokens.filter((t) => t.assetClass === assetClass);

    const sorted = [...filtered].sort((a, b) => {
      const sa = aggregated.get(a.id)!;
      const sb = aggregated.get(b.id)!;
      const va = sortKey === "supply" ? (sa.totalSupply ?? 0) : transferSum(sa);
      const vb = sortKey === "supply" ? (sb.totalSupply ?? 0) : transferSum(sb);
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return sorted;
  }, [assetClass, sortKey, sortDir, aggregated]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <aside className="flex h-full w-[20%] min-w-[320px] flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      <header className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-4 py-3.5">
        <div className="h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_10px_var(--color-accent)]" />
        <h1 className="text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-primary)]">
          RWA Radar
        </h1>
        {loading && (
          <span className="ml-auto flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--color-text-muted)]" />
            Loading
          </span>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-border-subtle)] px-3 py-3">
        {ASSET_CLASSES.map((ac) => {
          const active = assetClass === ac.id;
          return (
            <button
              key={ac.id}
              disabled={!ac.enabled}
              title={ac.enabled ? undefined : "Coming soon"}
              onClick={ac.enabled ? () => setAssetClass(ac.id) : undefined}
              className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10.5px] font-medium transition ${
                active
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)] text-[var(--color-text-primary)]"
                  : ac.enabled
                    ? "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                    : "cursor-not-allowed border-[var(--color-border-subtle)] text-[var(--color-text-muted)] opacity-60"
              }`}
            >
              {ac.label}
              {!ac.enabled && (
                <span className="rounded-sm bg-[var(--color-bg-elevated)] px-1 py-px text-[7.5px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[1fr_88px_84px] items-center gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/40 px-3 py-2 text-[9.5px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
        <span>Token</span>
        <button
          onClick={() => toggleSort("transfer")}
          className="flex items-center justify-end gap-1 transition hover:text-[var(--color-text-secondary)]"
        >
          Transfer 7d {sortIndicator(sortKey, "transfer", sortDir)}
        </button>
        <button
          onClick={() => toggleSort("supply")}
          className="flex items-center justify-end gap-1 transition hover:text-[var(--color-text-secondary)]"
        >
          Supply {sortIndicator(sortKey, "supply", sortDir)}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-[var(--color-text-muted)]">
            No tokens match
          </div>
        ) : (
          rows.map((t) => (
            <Row
              key={t.id}
              token={t}
              stats={aggregated.get(t.id)!}
              selected={t.id === selectedId}
              onClick={() => onSelect?.(t)}
            />
          ))
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/40 px-3 py-2 text-[9.5px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
        <span>{rows.length} tokens</span>
        <span className="font-mono">v2.0</span>
      </footer>
    </aside>
  );
}

function Row({
  token,
  stats,
  selected,
  onClick,
}: {
  token: Token;
  stats: TokenStats;
  selected: boolean;
  onClick: () => void;
}) {
  const series = stats.days.map((d) => d.dailyTransferAmount);
  const sum = transferSum(stats);
  const supply = stats.totalSupply;
  const positive = series.length >= 2 ? series[series.length - 1] >= series[0] : true;
  const chainColors = token.chains.slice(0, 5).map((c) => chainById(c.chainId).color);

  return (
    <button
      onClick={onClick}
      className={`group relative grid w-full grid-cols-[1fr_88px_84px] items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-2.5 text-left transition hover:bg-[var(--color-bg-hover)] ${
        selected ? "bg-[var(--color-bg-elevated)]" : ""
      }`}
    >
      {selected && (
        <span className="absolute left-0 top-0 h-full w-[2px] bg-[var(--color-accent)]" />
      )}
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-semibold leading-tight text-[var(--color-text-primary)]">
          {token.symbol}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="flex items-center gap-0.5">
            {chainColors.map((color, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: color }}
                aria-hidden="true"
              />
            ))}
          </span>
          <span className="truncate text-[10px] leading-tight text-[var(--color-text-tertiary)]">
            {token.chains.length} {token.chains.length === 1 ? "chain" : "chains"}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="font-mono text-[11px] leading-none tabular-nums text-[var(--color-text-secondary)]">
          {series.length ? formatCompact(sum) : "—"}
        </span>
        <div className="h-[18px]">
          {series.length >= 2 && (
            <Sparkline data={series} positive={positive} />
          )}
        </div>
      </div>

      <div className="text-right font-mono text-[12px] tabular-nums text-[var(--color-text-primary)]">
        {supply != null ? formatCompact(supply) : "—"}
      </div>
    </button>
  );
}

function sortIndicator(key: SortKey, target: SortKey, dir: SortDir) {
  if (key !== target) return <span className="opacity-30">↕</span>;
  return <span>{dir === "asc" ? "↑" : "↓"}</span>;
}
