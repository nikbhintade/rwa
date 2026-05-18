import type { Token, TokenStats, TokenDay } from "../types";

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? "GraphQL error");
  return json.data as T;
}

export function formatUnits(raw: string | bigint | number | null | undefined, decimals: number): number {
  if (raw == null) return 0;
  try {
    const big = typeof raw === "bigint" ? raw : BigInt(typeof raw === "number" ? Math.trunc(raw) : raw);
    const base = 10n ** BigInt(decimals);
    const whole = big / base;
    const frac = big % base;
    const result = Number(whole) + Number(frac) / Number(base);
    return Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

const DAY_SECS = 86400;

function todayMidnightSecs(): number {
  return Math.floor(Date.now() / 1000 / DAY_SECS) * DAY_SECS;
}

const BATCH_QUERY = `query BatchStats($addrs: [String!]!, $minDate: Int!) {
  Token(where: {address: {_in: $addrs}}) {
    address
    totalSupply
  }
  TokenDayData(
    where: {token: {address: {_in: $addrs}}, date: {_gte: $minDate}}
    order_by: {date: desc}
  ) {
    date
    dailyTransferAmount
    dailyTransferCount
    dailyMintAmount
    dailyBurnAmount
    token { address }
  }
}`;

type BatchRaw = {
  Token: { address: string; totalSupply: string }[];
  TokenDayData: {
    date: number;
    dailyTransferAmount: string;
    dailyTransferCount: number;
    dailyMintAmount: string;
    dailyBurnAmount: string;
    token: { address: string };
  }[];
};

function caseInsensitiveLookup(map: Map<string, Token>, addr: string): Token | undefined {
  return map.get(addr) ?? map.get(addr.toLowerCase());
}

export async function fetchAllStats(tokens: Token[]): Promise<Record<string, TokenStats>> {
  const addrs = tokens.map((t) => t.address);
  const minDate = todayMidnightSecs() - 7 * DAY_SECS;
  const data = await gql<BatchRaw>(BATCH_QUERY, { addrs, minDate });

  const tokensByAddr = new Map<string, Token>();
  for (const t of tokens) {
    tokensByAddr.set(t.address, t);
    tokensByAddr.set(t.address.toLowerCase(), t);
  }

  const result: Record<string, TokenStats> = {};
  for (const t of tokens) {
    result[t.address] = { totalSupply: null, days: [] };
  }

  for (const tok of data.Token) {
    const meta = caseInsensitiveLookup(tokensByAddr, tok.address);
    if (!meta) continue;
    result[meta.address].totalSupply = formatUnits(tok.totalSupply, meta.decimals);
  }

  const daysByAddr = new Map<string, TokenDay[]>();
  for (const d of data.TokenDayData) {
    const meta = caseInsensitiveLookup(tokensByAddr, d.token.address);
    if (!meta) continue;
    const arr = daysByAddr.get(meta.address) ?? [];
    arr.push({
      date: d.date,
      dailyTransferAmount: formatUnits(d.dailyTransferAmount, meta.decimals),
      dailyTransferCount: d.dailyTransferCount,
      dailyMintAmount: formatUnits(d.dailyMintAmount, meta.decimals),
      dailyBurnAmount: formatUnits(d.dailyBurnAmount, meta.decimals),
    });
    daysByAddr.set(meta.address, arr);
  }
  for (const [addr, arr] of daysByAddr) {
    arr.sort((a, b) => a.date - b.date);
    result[addr].days = arr;
  }
  return result;
}

const DETAIL_QUERY = `query TokenDetail($addr: String!, $minDate: Int!) {
  Token(where: {address: {_eq: $addr}}) {
    address
    totalSupply
  }
  TokenDayData(
    where: {token: {address: {_eq: $addr}}, date: {_gte: $minDate}}
    order_by: {date: asc}
  ) {
    date
    dailyTransferAmount
    dailyTransferCount
    dailyMintAmount
    dailyBurnAmount
  }
}`;

type DetailRaw = {
  Token: { address: string; totalSupply: string }[];
  TokenDayData: {
    date: number;
    dailyTransferAmount: string;
    dailyTransferCount: number;
    dailyMintAmount: string;
    dailyBurnAmount: string;
  }[];
};

export async function fetchTokenDetail(token: Token): Promise<TokenStats> {
  const minDate = todayMidnightSecs() - 365 * DAY_SECS;
  const data = await gql<DetailRaw>(DETAIL_QUERY, { addr: token.address, minDate });
  const supply = data.Token[0]?.totalSupply ?? null;
  const days = data.TokenDayData.map((d) => ({
    date: d.date,
    dailyTransferAmount: formatUnits(d.dailyTransferAmount, token.decimals),
    dailyTransferCount: d.dailyTransferCount,
    dailyMintAmount: formatUnits(d.dailyMintAmount, token.decimals),
    dailyBurnAmount: formatUnits(d.dailyBurnAmount, token.decimals),
  }));
  return {
    totalSupply: supply != null ? formatUnits(supply, token.decimals) : null,
    days,
  };
}

export type Timeframe = "weekly" | "monthly" | "yearly";

export function aggregateByTimeframe(days: TokenDay[], t: Timeframe): TokenDay[] {
  const sorted = [...days].sort((a, b) => a.date - b.date);
  if (t === "weekly") return sorted.slice(-7);
  if (t === "monthly") return sorted.slice(-30);
  return sorted.slice(-365);
}
