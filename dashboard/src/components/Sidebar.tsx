import { useMemo, useState } from "react";
import { tokens } from "../data/tokens";
import { chainById } from "../data/chains";
import type { Token, TokenStats } from "../types";
import { assembleFromChainStats, type ChainStatsMap } from "../lib/gql";
import { formatCompact } from "../lib/format";
import { Sparkline } from "./Sparkline";

type SortKey = "transfer" | "supply";
type SortDir = "asc" | "desc";

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
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("supply");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Aggregate each logical token across its chains from the per-chain map.
  const aggregated = useMemo(
    () => new Map(tokens.map((t) => [t.id, assembleFromChainStats(t, stats)])),
    [stats],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? tokens.filter(
          (t) =>
            t.symbol.toLowerCase().includes(q) ||
            t.name.toLowerCase().includes(q),
        )
      : tokens;

    const sorted = [...filtered].sort((a, b) => {
      const sa = aggregated.get(a.id)!;
      const sb = aggregated.get(b.id)!;
      const va = sortKey === "supply" ? (sa.totalSupply ?? 0) : transferSum(sa);
      const vb = sortKey === "supply" ? (sb.totalSupply ?? 0) : transferSum(sb);
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return sorted;
  }, [query, sortKey, sortDir, aggregated]);

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

      <div className="border-b border-[var(--color-border-subtle)] px-3 py-3">
        <div className="relative">
          <SearchIcon />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search token"
            className="h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-base)] pl-7 pr-2 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent-bg)]"
          />
        </div>
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
        <span>
          {rows.length} of {tokens.length} tokens
        </span>
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

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m11 11 3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
