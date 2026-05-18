import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Token, TokenDay, TokenStats } from "../types";
import { formatCompact } from "../lib/format";
import { aggregateByTimeframe, type Timeframe } from "../lib/gql";
import { exportData, type ExportFormat } from "../lib/export";

type Tab = "count" | "volume" | "mintburn";

type Props = {
  token: Token;
  sidebarStats?: TokenStats;
  detailStats?: TokenStats;
};

export function TokenDetail({ token, sidebarStats, detailStats }: Props) {
  const [tab, setTab] = useState<Tab>("volume");
  const [timeframe, setTimeframe] = useState<Timeframe>("weekly");
  const [copied, setCopied] = useState(false);

  const loading = !detailStats;
  const supply = detailStats?.totalSupply ?? sidebarStats?.totalSupply ?? null;

  const allDays = useMemo(
    () => detailStats?.days ?? sidebarStats?.days ?? [],
    [detailStats, sidebarStats],
  );
  const days = useMemo(
    () => aggregateByTimeframe(allDays, timeframe),
    [allDays, timeframe],
  );
  const prevDays = useMemo(
    () => prevPeriodDays(allDays, timeframe),
    [allDays, timeframe],
  );

  const totalTransfer = days.reduce((a, d) => a + d.dailyTransferAmount, 0);
  const totalCount = days.reduce((a, d) => a + d.dailyTransferCount, 0);
  const prevTransfer = prevDays.reduce((a, d) => a + d.dailyTransferAmount, 0);
  const prevCount = prevDays.reduce((a, d) => a + d.dailyTransferCount, 0);
  const transferDelta = pctDelta(totalTransfer, prevTransfer);
  const countDelta = pctDelta(totalCount, prevCount);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(token.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 p-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--color-border-subtle)] pb-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[24px] font-semibold leading-none text-[var(--color-text-primary)]">
            {token.symbol}
          </h2>
          <span className="text-[13px] text-[var(--color-text-secondary)]">
            {token.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2 py-1">
          <span className="font-mono text-[10.5px] text-[var(--color-text-tertiary)]">
            {shortAddr(token.address)}
          </span>
          <button
            onClick={handleCopy}
            title="Copy address"
            className="text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)]"
          >
            <CopyIcon />
          </button>
          <a
            href={`https://etherscan.io/token/${token.address}`}
            target="_blank"
            rel="noreferrer"
            title="View on Etherscan"
            className="text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)]"
          >
            <ExternalIcon />
          </a>
        </div>
        {copied && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-pos)]">
            Copied
          </span>
        )}
        <span className="rounded-sm border border-[var(--color-border-subtle)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Ethereum
        </span>
        <div className="ml-auto flex items-center gap-3">
          {loading && (
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Loading…
            </span>
          )}
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
            days={days}
            disabled={days.length === 0}
          />
        </div>

        <Tabs value={tab} onChange={setTab} />

        <div className="w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
          {days.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-[var(--color-text-muted)]">
              {loading ? "Loading…" : "No data"}
            </div>
          ) : tab === "count" ? (
            <SeriesChart
              days={days}
              timeframe={timeframe}
              valueKey="dailyTransferCount"
              format={(v) => v.toLocaleString()}
              label="Transfers"
              color="var(--color-accent)"
            />
          ) : tab === "volume" ? (
            <SeriesChart
              days={days}
              timeframe={timeframe}
              valueKey="dailyTransferAmount"
              format={(v) => `${formatCompact(v)} ${token.symbol}`}
              label="Volume"
              color="var(--color-accent)"
            />
          ) : (
            <MintBurnChart days={days} symbol={token.symbol} timeframe={timeframe} />
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
  const len = t === "weekly" ? 7 : t === "monthly" ? 30 : 365;
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
  days,
  disabled,
}: {
  token: Token;
  timeframe: Timeframe;
  days: TokenDay[];
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
    void exportData(token, timeframe, days, f);
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
        {delta != null && Number.isFinite(delta) && (
          <DeltaPill value={delta} />
        )}
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

type ChartDatum = {
  date: number;
  value: number;
  label: string;
};

function SeriesChart({
  days,
  timeframe,
  valueKey,
  format,
  label,
  color,
}: {
  days: TokenDay[];
  timeframe: Timeframe;
  valueKey: "dailyTransferAmount" | "dailyTransferCount";
  format: (v: number) => string;
  label: string;
  color: string;
}) {
  const data: ChartDatum[] = days.map((d) => ({
    date: d.date,
    value: Number.isFinite(d[valueKey]) ? d[valueKey] : 0,
    label: formatAxis(d.date, timeframe),
  }));
  const yearly = timeframe === "yearly";
  const max = Math.max(...data.map((d) => d.value), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          {label} · {tfLabel(timeframe)}
        </span>
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
          max {format(max)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={yearly ? 320 : 260}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 8, bottom: yearly ? 28 : 8 }}
          barCategoryGap={yearly ? "5%" : "20%"}
        >
          <defs>
            <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={color} stopOpacity={0.55} />
            </linearGradient>
          </defs>
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
              valueKey === "dailyTransferCount"
                ? Number(v).toLocaleString()
                : formatCompact(Number(v))
            }
            width={56}
          />
          <Tooltip
            cursor={{ fill: "var(--color-bg-hover)", opacity: 0.6 }}
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 6,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              padding: "6px 10px",
            }}
            labelStyle={{
              color: "var(--color-text-tertiary)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 2,
            }}
            itemStyle={{ color: "var(--color-text-primary)" }}
            formatter={(v) => [format(Number(v)), label] as [string, string]}
          />
          <Bar
            dataKey="value"
            fill="url(#barFill)"
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
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

type MintBurnDatum = {
  date: number;
  label: string;
  mint: number;
  burn: number;
};

function MintBurnChart({
  days,
  symbol,
  timeframe,
}: {
  days: TokenDay[];
  symbol: string;
  timeframe: Timeframe;
}) {
  const safe = (v: number) => (Number.isFinite(v) ? v : 0);
  const data: MintBurnDatum[] = days.map((d) => ({
    date: d.date,
    label: formatAxis(d.date, timeframe),
    mint: safe(d.dailyMintAmount),
    burn: -safe(d.dailyBurnAmount),
  }));
  const totalMint = data.reduce((a, d) => a + d.mint, 0);
  const totalBurn = -data.reduce((a, d) => a + d.burn, 0);
  const yearly = timeframe === "yearly";

  if (totalMint === 0 && totalBurn === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          Mint / Burn · {tfLabel(timeframe)}
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
          Mint / Burn · {tfLabel(timeframe)}
        </span>
        <span className="font-mono text-[10px]">
          <span className="text-[var(--color-pos)]">
            +{formatCompact(totalMint)}
          </span>
          <span className="text-[var(--color-text-muted)]"> / </span>
          <span className="text-[var(--color-neg)]">
            -{formatCompact(totalBurn)}
          </span>
          <span className="ml-1 text-[var(--color-text-tertiary)]">{symbol}</span>
        </span>
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
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 6,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              padding: "6px 10px",
            }}
            labelStyle={{
              color: "var(--color-text-tertiary)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 2,
            }}
            itemStyle={{ color: "var(--color-text-primary)" }}
            formatter={(v, name) => {
              const abs = Math.abs(Number(v));
              const sign = name === "Burn" ? "-" : "+";
              return [`${sign}${formatCompact(abs)} ${symbol}`, String(name)] as [string, string];
            }}
          />
          <Bar
            dataKey="mint"
            name="Mint"
            stackId="mb"
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.date} fill="var(--color-pos)" />
            ))}
          </Bar>
          <Bar
            dataKey="burn"
            name="Burn"
            stackId="mb"
            radius={[0, 0, 2, 2]}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.date} fill="var(--color-neg)" />
            ))}
          </Bar>
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

function formatAxis(dateSecs: number, _timeframe: Timeframe): string {
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
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="5"
        width="8"
        height="9"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M3 11V3a1 1 0 0 1 1-1h7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 2h5v5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M14 2 7 9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M12 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
