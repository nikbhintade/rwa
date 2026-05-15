import { useMemo, useState } from "react";
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

  const loading = !detailStats;
  const error: string | null = null;

  const supply = detailStats?.totalSupply ?? sidebarStats?.totalSupply ?? null;
  const days = useMemo(() => {
    const base = detailStats?.days ?? sidebarStats?.days ?? [];
    return aggregateByTimeframe(base, timeframe);
  }, [detailStats, sidebarStats, timeframe]);

  const totalTransfer = days.reduce((a, d) => a + d.dailyTransferAmount, 0);
  const totalCount = days.reduce((a, d) => a + d.dailyTransferCount, 0);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="flex items-baseline gap-3">
        <h2 className="text-[20px] font-semibold text-[var(--color-text-primary)]">
          {token.symbol}
        </h2>
        <span className="text-[12px] text-[var(--color-text-tertiary)]">
          {token.name}
        </span>
        {loading && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Loading…
          </span>
        )}
      </header>

      <div className="grid w-full max-w-3xl grid-cols-3 gap-3">
        <StatBox label="Total Supply" value={supply != null ? formatCompact(supply) : null} unit={token.symbol} />
        <StatBox label={`${tfLabel(timeframe)} Transfer Amount`} value={days.length ? formatCompact(totalTransfer) : null} unit={token.symbol} />
        <StatBox label={`${tfLabel(timeframe)} Transfer Count`} value={days.length ? totalCount.toLocaleString() : null} />
      </div>

      <section className="w-full max-w-3xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <TimeframeToggle value={timeframe} onChange={setTimeframe} />
          <DownloadMenu
            token={token}
            timeframe={timeframe}
            days={days}
            disabled={days.length === 0}
          />
        </div>

        <Tabs value={tab} onChange={setTab} />
        <div className="rounded-b-md rounded-tr-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          {error ? (
            <div className="py-8 text-center text-[12px] text-[var(--color-neg)]">
              {error}
            </div>
          ) : days.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-[var(--color-text-muted)]">
              {loading ? "Loading…" : "No data"}
            </div>
          ) : tab === "count" ? (
            <BarChart
              values={days.map((d) => d.dailyTransferCount)}
              dates={days.map((d) => d.date)}
              timeframe={timeframe}
              format={(v) => v.toLocaleString()}
              label="Transfers / period"
              color="var(--color-accent)"
            />
          ) : tab === "volume" ? (
            <BarChart
              values={days.map((d) => d.dailyTransferAmount)}
              dates={days.map((d) => d.date)}
              timeframe={timeframe}
              format={(v) => `${formatCompact(v)} ${token.symbol}`}
              label="Volume / period"
              color="var(--color-accent)"
            />
          ) : (
            <MintBurnChart days={days} symbol={token.symbol} timeframe={timeframe} />
          )}
        </div>
      </section>

      <div className="font-mono text-[10.5px] text-[var(--color-text-muted)]">
        {token.address}
      </div>
    </div>
  );
}

function tfLabel(t: Timeframe): string {
  return t === "weekly" ? "7d" : t === "monthly" ? "30d" : "12mo";
}

function TimeframeToggle({ value, onChange }: { value: Timeframe; onChange: (t: Timeframe) => void }) {
  const opts: { key: Timeframe; label: string }[] = [
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "yearly", label: "Yearly" },
  ];
  return (
    <div className="flex rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-0.5">
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`rounded px-3 py-1 text-[11px] font-medium transition ${
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
    { key: "volume", label: "Daily Volume" },
    { key: "count", label: "Daily Count" },
    { key: "mintburn", label: "Mint / Burn" },
  ];
  return (
    <div className="flex gap-0 border-b border-[var(--color-border-default)]">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`-mb-px border border-b-0 px-3 py-2 text-[11px] font-medium uppercase tracking-wider transition ${
              active
                ? "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]"
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

function StatBox({ label, value, unit }: { label: string; value: string | null; unit?: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </div>
      <div className="mt-2 font-mono text-[20px] font-medium tabular-nums text-[var(--color-text-primary)]">
        {value == null ? (
          <span className="text-[var(--color-text-muted)] text-[14px]">—</span>
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

function BarChart({
  values,
  dates,
  timeframe,
  format,
  label,
  color,
}: {
  values: number[];
  dates: number[];
  timeframe: Timeframe;
  format: (v: number) => string;
  label: string;
  color: string;
}) {
  const width = 720;
  const height = 180;
  const padY = 10;
  const safe = (v: number) => (Number.isFinite(v) ? v : 0);
  const safeVals = values.map(safe);
  const max = Math.max(...safeVals, 0);
  const colW = width / safeVals.length;
  const barW = colW * 0.65;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          {label}
        </span>
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
          max {format(max)}
        </span>
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        <line
          x1={0}
          y1={height - padY}
          x2={width}
          y2={height - padY}
          stroke="var(--color-border-default)"
          strokeWidth={1}
        />
        {safeVals.map((v, i) => {
          const cx = i * colW + colW / 2;
          const x = cx - barW / 2;
          const h = max > 0 ? (v / max) * (height - padY * 2) : 0;
          const y = height - padY - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={color}
              rx={1.5}
            >
              <title>{`${formatAxis(dates[i], timeframe)}: ${format(v)}`}</title>
            </rect>
          );
        })}
      </svg>
      <AxisLabels dates={dates} timeframe={timeframe} />
    </div>
  );
}

function MintBurnChart({
  days,
  symbol,
  timeframe,
}: {
  days: TokenDay[];
  symbol: string;
  timeframe: Timeframe;
}) {
  const width = 720;
  const height = 220;
  const padY = 10;
  const midY = height / 2;
  const usableY = midY - padY;
  const safe = (v: number) => (Number.isFinite(v) ? v : 0);
  const mints = days.map((d) => safe(d.dailyMintAmount));
  const burns = days.map((d) => safe(d.dailyBurnAmount));
  const maxAbs = Math.max(...mints, ...burns, 0);
  const totalMint = mints.reduce((a, v) => a + v, 0);
  const totalBurn = burns.reduce((a, v) => a + v, 0);
  const colW = width / days.length;
  const barW = colW * 0.55;

  if (totalMint === 0 && totalBurn === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Mint / Burn — {tfLabel(timeframe)}
        </div>
        <div className="py-8 text-center text-[12px] text-[var(--color-text-muted)]">
          No mint or burn activity in this period
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Mint / Burn — {tfLabel(timeframe)}
        </span>
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
          <span className="text-[var(--color-pos)]">+{formatCompact(totalMint)}</span>
          {" / "}
          <span className="text-[var(--color-neg)]">-{formatCompact(totalBurn)}</span>
          {" "}{symbol}
        </span>
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        <line
          x1={0}
          y1={midY}
          x2={width}
          y2={midY}
          stroke="var(--color-border-default)"
          strokeWidth={1}
        />
        {days.map((d, i) => {
          const cx = i * colW + colW / 2;
          const x = cx - barW / 2;
          const m = safe(d.dailyMintAmount);
          const b = safe(d.dailyBurnAmount);
          const mintH = maxAbs > 0 ? (m / maxAbs) * usableY : 0;
          const burnH = maxAbs > 0 ? (b / maxAbs) * usableY : 0;
          return (
            <g key={d.date}>
              {mintH > 0 && (
                <rect
                  x={x}
                  y={midY - mintH}
                  width={barW}
                  height={mintH}
                  fill="var(--color-pos)"
                  rx={1.5}
                >
                  <title>{`${formatAxis(d.date, timeframe)} mint: +${formatCompact(m)} ${symbol}`}</title>
                </rect>
              )}
              {burnH > 0 && (
                <rect
                  x={x}
                  y={midY}
                  width={barW}
                  height={burnH}
                  fill="var(--color-neg)"
                  rx={1.5}
                >
                  <title>{`${formatAxis(d.date, timeframe)} burn: -${formatCompact(b)} ${symbol}`}</title>
                </rect>
              )}
            </g>
          );
        })}
      </svg>
      <AxisLabels dates={days.map((d) => d.date)} timeframe={timeframe} />
    </div>
  );
}

function AxisLabels({ dates, timeframe }: { dates: number[]; timeframe: Timeframe }) {
  const maxLabels = 12;
  const step = Math.max(1, Math.ceil(dates.length / maxLabels));
  return (
    <div className="flex justify-between font-mono text-[10px] text-[var(--color-text-muted)]">
      {dates.map((d, i) => (
        <span key={d} className="flex-1 text-center">
          {i % step === 0 ? formatAxis(d, timeframe) : ""}
        </span>
      ))}
    </div>
  );
}

function formatAxis(dayId: number, timeframe: Timeframe): string {
  const d = new Date(dayId * 86400 * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  if (timeframe === "yearly") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
