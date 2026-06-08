import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChainSeries, Token, TokenDay, TokenStats } from "../types";
import { chainById, tokenExplorerUrl } from "../data/chains";
import { formatCompact } from "../lib/format";
import {
  aggregateByTimeframe,
  timeframeDates,
  timeframeLen,
  type Timeframe,
} from "../lib/gql";
import { exportData, type ExportFormat } from "../lib/export";
import { shareUrl } from "../lib/router";

type Tab = "count" | "volume" | "mintburn";

type Props = {
  token: Token;
  // null = all chains; otherwise scope to a single chain (controlled, URL-synced).
  chainFilter: number | null;
  onChainFilter: (chainId: number | null) => void;
  sidebarStats?: TokenStats;
  detailStats?: TokenStats;
};

type ChainMeta = { chainId: number; name: string; color: string };

export function TokenDetail({
  token,
  chainFilter,
  onChainFilter,
  sidebarStats,
  detailStats,
}: Props) {
  const [tab, setTab] = useState<Tab>("volume");
  const [timeframe, setTimeframe] = useState<Timeframe>("weekly");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const loading = !detailStats;
  const stats = detailStats ?? sidebarStats;

  const fullByChain = useMemo(() => stats?.byChain ?? [], [stats]);

  // Apply the chain filter: scope every metric to the selected chain (or all).
  const byChain = useMemo(
    () =>
      chainFilter == null
        ? fullByChain
        : fullByChain.filter((s) => s.chainId === chainFilter),
    [fullByChain, chainFilter],
  );
  const allDays = useMemo(
    () => (chainFilter == null ? (stats?.days ?? []) : (byChain[0]?.days ?? [])),
    [stats, chainFilter, byChain],
  );
  const supply = useMemo(() => {
    if (chainFilter == null) return stats?.totalSupply ?? null;
    return byChain[0]?.totalSupply ?? null;
  }, [stats, chainFilter, byChain]);

  const activeStats: TokenStats | undefined = useMemo(
    () => (stats ? { totalSupply: supply, days: allDays, byChain } : undefined),
    [stats, supply, allDays, byChain],
  );

  const days = useMemo(() => aggregateByTimeframe(allDays, timeframe), [allDays, timeframe]);
  const prevDays = useMemo(() => prevPeriodDays(allDays, timeframe), [allDays, timeframe]);

  // Chains that actually carry data (already sorted by supply in fetchTokenDetail).
  const chainMetas: ChainMeta[] = useMemo(
    () =>
      byChain.map((s) => {
        const c = chainById(s.chainId);
        return { chainId: s.chainId, name: c.name, color: c.color };
      }),
    [byChain],
  );

  const windowDates = useMemo(() => timeframeDates(allDays, timeframe), [allDays, timeframe]);

  const scopeLabel = chainFilter == null ? "all chains" : chainById(chainFilter).name;

  const totalTransfer = days.reduce((a, d) => a + d.dailyTransferAmount, 0);
  const totalCount = days.reduce((a, d) => a + d.dailyTransferCount, 0);
  const prevTransfer = prevDays.reduce((a, d) => a + d.dailyTransferAmount, 0);
  const prevCount = prevDays.reduce((a, d) => a + d.dailyTransferCount, 0);
  const transferDelta = pctDelta(totalTransfer, prevTransfer);
  const countDelta = pctDelta(totalCount, prevCount);

  async function handleCopy(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function handleShare() {
    const url = shareUrl(token.id, chainFilter);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore — clipboard may be unavailable */
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 p-6">
      <header className="flex flex-col gap-3 border-b border-[var(--color-border-subtle)] pb-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[24px] font-semibold leading-none text-[var(--color-text-primary)]">
              {token.symbol}
            </h2>
            <span className="text-[13px] text-[var(--color-text-secondary)]">
              {token.name}
            </span>
          </div>
          <span className="rounded-sm border border-[var(--color-border-subtle)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            {token.chains.length} {token.chains.length === 1 ? "chain" : "chains"}
          </span>
          {copied && (
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-pos)]">
              Copied
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            {loading && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                Loading…
              </span>
            )}
            <button
              onClick={handleShare}
              title="Copy shareable link"
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-hover)]"
            >
              <ShareIcon />
              {linkCopied ? "Link copied" : "Share"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onChainFilter(null)}
            className={`rounded-md border px-2.5 py-1 text-[10.5px] font-medium transition ${
              chainFilter == null
                ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)] text-[var(--color-text-primary)]"
                : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            All chains
          </button>
          {token.chains.map((c) => (
            <ChainChip
              key={`${c.chainId}:${c.address}`}
              chainId={c.chainId}
              address={c.address}
              active={c.chainId === chainFilter}
              onToggle={() => onChainFilter(c.chainId === chainFilter ? null : c.chainId)}
              onCopy={() => handleCopy(c.address)}
            />
          ))}
        </div>
      </header>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatBox
          label="Total Supply"
          value={supply != null ? formatCompact(supply) : null}
          unit={token.symbol}
        />
        <StatBox
          label={`${tfLabel(timeframe)} Transfer Amount`}
          value={days.length ? formatCompact(totalTransfer) : null}
          unit={token.symbol}
          delta={prevDays.length ? transferDelta : null}
        />
        <StatBox
          label={`${tfLabel(timeframe)} Transfer Count`}
          value={days.length ? totalCount.toLocaleString() : null}
          delta={prevDays.length ? countDelta : null}
        />
      </div>

      <section className="flex w-full flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TimeframeToggle value={timeframe} onChange={setTimeframe} />
          <DownloadMenu
            token={token}
            timeframe={timeframe}
            stats={activeStats}
            disabled={!activeStats || windowDates.length === 0}
          />
        </div>

        <Tabs value={tab} onChange={setTab} />

        {chainMetas.length > 0 && <ChainLegend chains={chainMetas} />}

        <div className="w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
          {windowDates.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-[var(--color-text-muted)]">
              {loading ? "Loading…" : "No data"}
            </div>
          ) : tab === "count" ? (
            <StackedSeriesChart
              byChain={byChain}
              chains={chainMetas}
              windowDates={windowDates}
              timeframe={timeframe}
              scopeLabel={scopeLabel}
              valueKey="dailyTransferCount"
              format={(v) => v.toLocaleString()}
              label="Transfers"
              isCount
            />
          ) : tab === "volume" ? (
            <StackedSeriesChart
              byChain={byChain}
              chains={chainMetas}
              windowDates={windowDates}
              timeframe={timeframe}
              scopeLabel={scopeLabel}
              valueKey="dailyTransferAmount"
              format={(v) => `${formatCompact(v)} ${token.symbol}`}
              label="Volume"
            />
          ) : (
            <StackedMintBurnChart
              byChain={byChain}
              chains={chainMetas}
              windowDates={windowDates}
              timeframe={timeframe}
              scopeLabel={scopeLabel}
              symbol={token.symbol}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function tfLabel(t: Timeframe): string {
  return t === "weekly" ? "7d" : t === "monthly" ? "30d" : "365d";
}

function prevPeriodDays(all: TokenDay[], t: Timeframe): TokenDay[] {
  const sorted = [...all].sort((a, b) => a.date - b.date);
  const len = timeframeLen(t);
  const end = sorted.length - len;
  if (end <= 0) return [];
  const start = Math.max(0, end - len);
  return sorted.slice(start, end);
}

function pctDelta(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function ChainChip({
  chainId,
  address,
  active,
  onToggle,
  onCopy,
}: {
  chainId: number;
  address: string;
  active: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  const chain = chainById(chainId);
  const url = tokenExplorerUrl(chainId, address);
  return (
    <span
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition ${
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)]"
          : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)]"
      }`}
    >
      <button
        onClick={onToggle}
        title={active ? `Showing ${chain.name} only — click to clear` : `Filter to ${chain.name}`}
        className="flex items-center gap-1.5"
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: chain.color }}
          aria-hidden="true"
        />
        <span
          className={`text-[10.5px] font-medium ${
            active ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
          }`}
        >
          {chain.name}
        </span>
        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
          {shortAddr(address)}
        </span>
      </button>
      <button
        onClick={onCopy}
        title="Copy address"
        className="text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)]"
      >
        <CopyIcon />
      </button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title={`View on ${chain.name} explorer`}
          className="text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)]"
        >
          <ExternalIcon />
        </a>
      )}
    </span>
  );
}

function ChainLegend({ chains }: { chains: ChainMeta[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {chains.map((c) => (
        <span key={c.chainId} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-[2px]"
            style={{ background: c.color }}
            aria-hidden="true"
          />
          <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
            {c.name}
          </span>
        </span>
      ))}
    </div>
  );
}

function TimeframeToggle({
  value,
  onChange,
}: {
  value: Timeframe;
  onChange: (t: Timeframe) => void;
}) {
  const opts: { key: Timeframe; label: string }[] = [
    { key: "weekly", label: "7D" },
    { key: "monthly", label: "30D" },
    { key: "yearly", label: "1Y" },
  ];
  return (
    <div className="flex rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-0.5">
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`rounded px-3 py-1 text-[11px] font-medium tracking-wide transition ${
              active
                ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function DownloadMenu({
  token,
  timeframe,
  stats,
  disabled,
}: {
  token: Token;
  timeframe: Timeframe;
  stats?: TokenStats;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const formats: { key: ExportFormat; label: string }[] = [
    { key: "csv", label: "CSV" },
    { key: "xlsx", label: "XLSX" },
    { key: "xls", label: "XLS" },
    { key: "pdf", label: "PDF" },
  ];
  function handle(f: ExportFormat) {
    setOpen(false);
    if (stats) void exportData(token, timeframe, stats, f);
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Download
        <span className="text-[9px] opacity-60">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-32 overflow-hidden rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-lg">
          {formats.map((f) => (
            <button
              key={f.key}
              onClick={() => handle(f.key)}
              className="block w-full px-3 py-2 text-left text-[11px] font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-hover)]"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "volume", label: "Volume" },
    { key: "count", label: "Transfers" },
    { key: "mintburn", label: "Mint / Burn" },
  ];
  return (
    <div className="flex gap-6 border-b border-[var(--color-border-subtle)]">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`-mb-px border-b-2 px-0.5 py-2 text-[11px] font-medium uppercase tracking-[0.08em] transition ${
              active
                ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function StatBox({
  label,
  value,
  unit,
  delta,
}: {
  label: string;
  value: string | null;
  unit?: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          {label}
        </div>
        {delta != null && Number.isFinite(delta) && <DeltaPill value={delta} />}
      </div>
      <div className="mt-2 font-mono text-[22px] font-medium leading-none tabular-nums text-[var(--color-text-primary)]">
        {value == null ? (
          <span className="text-[14px] text-[var(--color-text-muted)]">—</span>
        ) : (
          <>
            {value}
            {unit && (
              <span className="ml-2 text-[11px] text-[var(--color-text-tertiary)]">
                {unit}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DeltaPill({ value }: { value: number }) {
  const positive = value >= 0;
  const color = positive ? "var(--color-pos)" : "var(--color-neg)";
  const bg = positive ? "var(--color-pos-bg)" : "var(--color-neg-bg)";
  return (
    <span
      className="rounded-sm px-1.5 py-[2px] font-mono text-[10px] font-medium tabular-nums"
      style={{ color, background: bg }}
    >
      {positive ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/** chainId -> (date -> TokenDay) for O(1) lookup while building chart rows. */
function buildLookup(byChain: ChainSeries[]): Map<number, Map<number, TokenDay>> {
  const m = new Map<number, Map<number, TokenDay>>();
  for (const s of byChain) {
    const inner = new Map<number, TokenDay>();
    for (const d of s.days) inner.set(d.date, d);
    m.set(s.chainId, inner);
  }
  return m;
}

const TOOLTIP_STYLE = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border-default)",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  padding: "6px 10px",
} as const;

type StackRow = { date: number; label: string } & Record<string, number | string>;

function StackedSeriesChart({
  byChain,
  chains,
  windowDates,
  timeframe,
  scopeLabel,
  valueKey,
  format,
  label,
  isCount,
}: {
  byChain: ChainSeries[];
  chains: ChainMeta[];
  windowDates: number[];
  timeframe: Timeframe;
  scopeLabel: string;
  valueKey: "dailyTransferAmount" | "dailyTransferCount";
  format: (v: number) => string;
  label: string;
  isCount?: boolean;
}) {
  const lookup = useMemo(() => buildLookup(byChain), [byChain]);
  const data: StackRow[] = windowDates.map((date) => {
    const row: StackRow = { date, label: formatAxis(date) };
    for (const c of chains) {
      const v = lookup.get(c.chainId)?.get(date)?.[valueKey];
      row[`c${c.chainId}`] = Number.isFinite(v) ? (v as number) : 0;
    }
    return row;
  });
  const yearly = timeframe === "yearly";
  const max = Math.max(
    ...data.map((r) => chains.reduce((a, c) => a + (r[`c${c.chainId}`] as number), 0)),
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          {label} · {tfLabel(timeframe)} · {scopeLabel}
        </span>
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
          peak {format(max)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={yearly ? 320 : 260}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 8, bottom: yearly ? 28 : 8 }}
          barCategoryGap={yearly ? "5%" : "20%"}
        >
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="var(--color-border-subtle)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border-default)" }}
            interval="preserveStartEnd"
            minTickGap={yearly ? 40 : 20}
          />
          <YAxis
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              isCount ? Number(v).toLocaleString() : formatCompact(Number(v))
            }
            width={56}
          />
          <Tooltip
            cursor={{ fill: "var(--color-bg-hover)", opacity: 0.6 }}
            contentStyle={TOOLTIP_STYLE}
            content={<StackTooltip chains={chains} format={format} />}
          />
          {chains.map((c, i) => (
            <Bar
              key={c.chainId}
              dataKey={`c${c.chainId}`}
              name={c.name}
              stackId="s"
              fill={c.color}
              isAnimationActive={false}
              radius={i === chains.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
          {yearly && (
            <Brush
              dataKey="label"
              height={22}
              stroke="var(--color-border-strong)"
              fill="var(--color-bg-base)"
              travellerWidth={8}
              tickFormatter={() => ""}
              y={290}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StackedMintBurnChart({
  byChain,
  chains,
  windowDates,
  timeframe,
  scopeLabel,
  symbol,
}: {
  byChain: ChainSeries[];
  chains: ChainMeta[];
  windowDates: number[];
  timeframe: Timeframe;
  scopeLabel: string;
  symbol: string;
}) {
  const lookup = useMemo(() => buildLookup(byChain), [byChain]);
  const data: StackRow[] = windowDates.map((date) => {
    const row: StackRow = { date, label: formatAxis(date) };
    for (const c of chains) {
      const d = lookup.get(c.chainId)?.get(date);
      row[`m${c.chainId}`] = d ? safe(d.dailyMintAmount) : 0;
      row[`b${c.chainId}`] = d ? -safe(d.dailyBurnAmount) : 0;
    }
    return row;
  });
  const totalMint = data.reduce(
    (a, r) => a + chains.reduce((s, c) => s + (r[`m${c.chainId}`] as number), 0),
    0,
  );
  const totalBurn = -data.reduce(
    (a, r) => a + chains.reduce((s, c) => s + (r[`b${c.chainId}`] as number), 0),
    0,
  );
  const yearly = timeframe === "yearly";

  if (totalMint === 0 && totalBurn === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          Mint / Burn · {tfLabel(timeframe)} · {scopeLabel}
        </div>
        <div className="py-8 text-center text-[12px] text-[var(--color-text-muted)]">
          No mint or burn activity in this period
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          Mint / Burn · {tfLabel(timeframe)} · {scopeLabel}
        </span>
        <span className="font-mono text-[10px]">
          <span className="text-[var(--color-pos)]">+{formatCompact(totalMint)}</span>
          <span className="text-[var(--color-text-muted)]"> / </span>
          <span className="text-[var(--color-neg)]">-{formatCompact(totalBurn)}</span>
          <span className="ml-1 text-[var(--color-text-tertiary)]">{symbol}</span>
        </span>
      </div>
      <div className="text-[9px] text-[var(--color-text-muted)]">
        Bars above zero = mint, below zero = burn · color = chain
      </div>
      <ResponsiveContainer width="100%" height={yearly ? 340 : 280}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 8, bottom: yearly ? 28 : 8 }}
          stackOffset="sign"
          barCategoryGap={yearly ? "5%" : "20%"}
        >
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="var(--color-border-subtle)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border-default)" }}
            interval="preserveStartEnd"
            minTickGap={yearly ? 40 : 20}
          />
          <YAxis
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCompact(Math.abs(Number(v)))}
            width={56}
          />
          <ReferenceLine y={0} stroke="var(--color-border-default)" />
          <Tooltip
            cursor={{ fill: "var(--color-bg-hover)", opacity: 0.6 }}
            contentStyle={TOOLTIP_STYLE}
            content={<MintBurnTooltip chains={chains} symbol={symbol} />}
          />
          {chains.map((c) => (
            <Bar
              key={`m${c.chainId}`}
              dataKey={`m${c.chainId}`}
              name={`${c.name} mint`}
              stackId="mb"
              fill={c.color}
              isAnimationActive={false}
            />
          ))}
          {chains.map((c) => (
            <Bar
              key={`b${c.chainId}`}
              dataKey={`b${c.chainId}`}
              name={`${c.name} burn`}
              stackId="mb"
              fill={c.color}
              fillOpacity={0.5}
              isAnimationActive={false}
            />
          ))}
          {yearly && (
            <Brush
              dataKey="label"
              height={22}
              stroke="var(--color-border-strong)"
              fill="var(--color-bg-base)"
              travellerWidth={8}
              tickFormatter={() => ""}
              y={310}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type TooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: { dataKey?: string | number; value?: number }[];
};

function StackTooltip({
  active,
  label,
  payload,
  chains,
  format,
}: TooltipProps & { chains: ChainMeta[]; format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const rows = chains
    .map((c) => ({
      c,
      v: Number(payload.find((p) => p.dataKey === `c${c.chainId}`)?.value ?? 0),
    }))
    .filter((r) => r.v !== 0);
  const total = rows.reduce((a, r) => a + r.v, 0);
  return (
    <div style={TOOLTIP_STYLE}>
      <div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
        {label}
      </div>
      {rows.map((r) => (
        <div key={r.c.chainId} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: r.c.color }} />
          <span className="text-[var(--color-text-secondary)]">{r.c.name}</span>
          <span className="ml-auto pl-3 text-[var(--color-text-primary)]">{format(r.v)}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-1.5 border-t border-[var(--color-border-subtle)] pt-1">
        <span className="text-[var(--color-text-tertiary)]">Total</span>
        <span className="ml-auto pl-3 text-[var(--color-text-primary)]">{format(total)}</span>
      </div>
    </div>
  );
}

function MintBurnTooltip({
  active,
  label,
  payload,
  chains,
  symbol,
}: TooltipProps & { chains: ChainMeta[]; symbol: string }) {
  if (!active || !payload?.length) return null;
  const rows = chains
    .map((c) => ({
      c,
      mint: Number(payload.find((p) => p.dataKey === `m${c.chainId}`)?.value ?? 0),
      burn: -Number(payload.find((p) => p.dataKey === `b${c.chainId}`)?.value ?? 0),
    }))
    .filter((r) => r.mint !== 0 || r.burn !== 0);
  return (
    <div style={TOOLTIP_STYLE}>
      <div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
        {label}
      </div>
      {rows.map((r) => (
        <div key={r.c.chainId} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: r.c.color }} />
          <span className="text-[var(--color-text-secondary)]">{r.c.name}</span>
          <span className="ml-auto pl-3">
            <span className="text-[var(--color-pos)]">+{formatCompact(r.mint)}</span>
            <span className="text-[var(--color-text-muted)]"> / </span>
            <span className="text-[var(--color-neg)]">-{formatCompact(r.burn)}</span>
          </span>
        </div>
      ))}
      <div className="mt-1 text-[9px] text-[var(--color-text-muted)]">{symbol}</div>
    </div>
  );
}

function safe(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

function formatAxis(dateSecs: number): string {
  if (!Number.isFinite(dateSecs)) return "—";
  const d = new Date(dateSecs * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M3 11V3a1 1 0 0 1 1-1h7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="12" cy="3.5" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="4" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12" cy="12.5" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M10.4 4.5 5.6 7M5.6 9l4.8 2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9 2h5v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M14 2 7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M12 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
