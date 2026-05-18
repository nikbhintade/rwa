import type { Token, TokenDay } from "../types";
import type { Timeframe } from "./gql";

export type ExportFormat = "csv" | "xls" | "xlsx" | "pdf";

const COLUMNS = [
  "Date",
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

function buildRows(days: TokenDay[]) {
  return days.map((d) => [
    dateSecsToISO(d.date),
    d.dailyTransferAmount,
    d.dailyTransferCount,
    d.dailyMintAmount,
    d.dailyBurnAmount,
  ]);
}

function fileName(token: Token, timeframe: Timeframe, ext: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${token.symbol}_${timeframe}_${stamp}.${ext}`;
}

function metaHeader(token: Token, timeframe: Timeframe): string[][] {
  return [
    ["Token", token.symbol],
    ["Name", token.name],
    ["Address", token.address],
    ["Decimals", String(token.decimals)],
    ["Timeframe", timeframe],
    ["Generated", new Date().toISOString()],
  ];
}

export async function exportData(
  token: Token,
  timeframe: Timeframe,
  days: TokenDay[],
  format: ExportFormat,
): Promise<void> {
  if (format === "csv") return exportCSV(token, timeframe, days);
  if (format === "pdf") return exportPDF(token, timeframe, days);
  return exportExcel(token, timeframe, days, format);
}

function escapeCSV(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCSV(token: Token, timeframe: Timeframe, days: TokenDay[]) {
  const lines: string[] = [];
  for (const [k, v] of metaHeader(token, timeframe)) {
    lines.push(`${escapeCSV(k)},${escapeCSV(v)}`);
  }
  lines.push("");
  lines.push(COLUMNS.map(escapeCSV).join(","));
  for (const row of buildRows(days)) {
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
  days: TokenDay[],
  format: "xls" | "xlsx",
) {
  const XLSX = await import("xlsx");
  const meta = metaHeader(token, timeframe);
  const sheetData: (string | number)[][] = [
    ...meta,
    [],
    COLUMNS,
    ...buildRows(days),
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [{ wch: 26 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
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

async function exportPDF(token: Token, timeframe: Timeframe, days: TokenDay[]) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`${token.symbol} — ${token.name}`, 14, 16);
  doc.setFontSize(9);
  let y = 24;
  for (const [k, v] of metaHeader(token, timeframe)) {
    doc.text(`${k}: ${v}`, 14, y);
    y += 5;
  }
  autoTable(doc, {
    startY: y + 4,
    head: [COLUMNS],
    body: buildRows(days).map((r) =>
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
