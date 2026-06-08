import type { Token, TokenStats } from "../types";
import { chainById } from "../data/chains";
import { timeframeDates, type Timeframe } from "./gql";

export type ExportFormat = "csv" | "xls" | "xlsx" | "pdf";

const COLUMNS = [
  "Date",
  "Chain",
  "Daily Transfer Amount",
  "Daily Transfer Count",
  "Daily Mint Amount",
  "Daily Burn Amount",
];

function dateSecsToISO(secs: number): string {
  const n = Number(secs);
  if (!Number.isFinite(n)) return "";
  const d = new Date(n * 1000);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

type Row = [string, string, number, number, number, number];

/** One row per (date, chain) within the timeframe window, sorted by date then chain. */
function buildRows(stats: TokenStats, timeframe: Timeframe): Row[] {
  const dates = new Set(timeframeDates(stats.days, timeframe));
  const rows: Row[] = [];
  for (const series of stats.byChain) {
    const chainName = chainById(series.chainId).name;
    for (const d of series.days) {
      if (!dates.has(d.date)) continue;
      rows.push([
        dateSecsToISO(d.date),
        chainName,
        d.dailyTransferAmount,
        d.dailyTransferCount,
        d.dailyMintAmount,
        d.dailyBurnAmount,
      ]);
    }
  }
  rows.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return rows;
}

function fileName(token: Token, timeframe: Timeframe, ext: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${token.symbol}_multichain_${timeframe}_${stamp}.${ext}`;
}

function metaHeader(token: Token, timeframe: Timeframe): string[][] {
  const chainList = token.chains
    .map((c) => `${chainById(c.chainId).name} (${c.address})`)
    .join("; ");
  return [
    ["Token", token.symbol],
    ["Name", token.name],
    ["Chains", chainList],
    ["Timeframe", timeframe],
    ["Generated", new Date().toISOString()],
  ];
}

export async function exportData(
  token: Token,
  timeframe: Timeframe,
  stats: TokenStats,
  format: ExportFormat,
): Promise<void> {
  const rows = buildRows(stats, timeframe);
  if (format === "csv") return exportCSV(token, timeframe, rows);
  if (format === "pdf") return exportPDF(token, timeframe, rows);
  return exportExcel(token, timeframe, rows, format);
}

function escapeCSV(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCSV(token: Token, timeframe: Timeframe, rows: Row[]) {
  const lines: string[] = [];
  for (const [k, v] of metaHeader(token, timeframe)) {
    lines.push(`${escapeCSV(k)},${escapeCSV(v)}`);
  }
  lines.push("");
  lines.push(COLUMNS.map(escapeCSV).join(","));
  for (const row of rows) {
    lines.push(row.map(escapeCSV).join(","));
  }
  triggerDownload(
    new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }),
    fileName(token, timeframe, "csv"),
  );
}

async function exportExcel(
  token: Token,
  timeframe: Timeframe,
  rows: Row[],
  format: "xls" | "xlsx",
) {
  const XLSX = await import("xlsx");
  const meta = metaHeader(token, timeframe);
  const sheetData: (string | number)[][] = [...meta, [], COLUMNS, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${token.symbol} ${timeframe}`);
  const bookType = format === "xls" ? "biff8" : "xlsx";
  const out = XLSX.write(wb, { bookType, type: "array" });
  const mime =
    format === "xls"
      ? "application/vnd.ms-excel"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  triggerDownload(new Blob([out], { type: mime }), fileName(token, timeframe, format));
}

async function exportPDF(token: Token, timeframe: Timeframe, rows: Row[]) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`${token.symbol} — ${token.name}`, 14, 16);
  doc.setFontSize(9);
  let y = 24;
  for (const [k, v] of metaHeader(token, timeframe)) {
    const text = `${k}: ${v}`;
    const wrapped = doc.splitTextToSize(text, 270) as string[];
    for (const line of wrapped) {
      doc.text(line, 14, y);
      y += 5;
    }
  }
  autoTable(doc, {
    startY: y + 4,
    head: [COLUMNS],
    body: rows.map((r) =>
      r.map((c) => (typeof c === "number" ? c.toLocaleString() : c)),
    ),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [22, 25, 34], textColor: 230 },
  });
  doc.save(fileName(token, timeframe, "pdf"));
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
