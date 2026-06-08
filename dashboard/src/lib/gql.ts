import type { ChainSeries, ChainToken, Token, TokenDay, TokenStats } from "../types";

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/graphql", {
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

/** Key a (chainId, address) pair so the same address on two chains stays distinct. */
function chainKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

/** Sidebar stats are keyed per chain-deployment, since each flat row is one chain. */
export type ChainStatsMap = Record<string, ChainSeries>;

const BATCH_QUERY = `query BatchStats($addrs: [String!]!, $minDate: Int!) {
  Token(where: {address: {_in: $addrs}}) {
    chainId
    address
    totalSupply
  }
  TokenDayData(
    where: {token: {address: {_in: $addrs}}, date: {_gte: $minDate}}
    order_by: {date: desc}
  ) {
    chainId
    date
    dailyTransferAmount
    dailyTransferCount
    dailyMintAmount
    dailyBurnAmount
    token { address }
  }
}`;

type TokenRaw = { chainId: number; address: string; totalSupply: string };
type DayRaw = {
  chainId: number;
  date: number;
  dailyTransferAmount: string;
  dailyTransferCount: number;
  dailyMintAmount: string;
  dailyBurnAmount: string;
  token: { address: string };
};
type BatchRaw = { Token: TokenRaw[]; TokenDayData: DayRaw[] };

/** Build a lookup of every valid (chainId, address) deployment -> its ChainToken. */
function deploymentIndex(tokens: Token[]): Map<string, ChainToken> {
  const m = new Map<string, ChainToken>();
  for (const t of tokens) {
    for (const c of t.chains) m.set(chainKey(c.chainId, c.address), c);
  }
  return m;
}

function uniqueAddrs(tokens: Token[]): string[] {
  const set = new Set<string>();
  for (const t of tokens) for (const c of t.chains) set.add(c.address);
  return [...set];
}

/** Per-chain 7-day stats for every deployment, keyed by `${chainId}:${address}`. */
export async function fetchAllStats(tokens: Token[]): Promise<ChainStatsMap> {
  const addrs = uniqueAddrs(tokens);
  const minDate = todayMidnightSecs() - 7 * DAY_SECS;
  const data = await gql<BatchRaw>(BATCH_QUERY, { addrs, minDate });
  const index = deploymentIndex(tokens);

  const result: ChainStatsMap = {};
  for (const c of index.values()) {
    result[chainKey(c.chainId, c.address)] = { chainId: c.chainId, totalSupply: null, days: [] };
  }

  for (const tok of data.Token) {
    const k = chainKey(tok.chainId, tok.address);
    const dep = index.get(k);
    if (!dep) continue;
    result[k].totalSupply = formatUnits(tok.totalSupply, dep.decimals);
  }

  for (const d of data.TokenDayData) {
    const k = chainKey(d.chainId, d.token.address);
    const dep = index.get(k);
    if (!dep) continue;
    result[k].days.push(toDay(d, dep.decimals));
  }
  for (const series of Object.values(result)) {
    series.days.sort((a, b) => a.date - b.date);
  }
  return result;
}

const DETAIL_QUERY = `query TokenDetail($addrs: [String!]!, $minDate: Int!) {
  Token(where: {address: {_in: $addrs}}) {
    chainId
    address
    totalSupply
  }
  TokenDayData(
    where: {token: {address: {_in: $addrs}}, date: {_gte: $minDate}}
    order_by: {date: asc}
  ) {
    chainId
    date
    dailyTransferAmount
    dailyTransferCount
    dailyMintAmount
    dailyBurnAmount
    token { address }
  }
}`;

function toDay(d: DayRaw, decimals: number): TokenDay {
  return {
    date: d.date,
    dailyTransferAmount: formatUnits(d.dailyTransferAmount, decimals),
    dailyTransferCount: d.dailyTransferCount,
    dailyMintAmount: formatUnits(d.dailyMintAmount, decimals),
    dailyBurnAmount: formatUnits(d.dailyBurnAmount, decimals),
  };
}

/** 365-day stats for one logical token: per-chain series plus a summed aggregate. */
export async function fetchTokenDetail(token: Token): Promise<TokenStats> {
  const minDate = todayMidnightSecs() - 365 * DAY_SECS;
  const addrs = token.chains.map((c) => c.address);
  const data = await gql<BatchRaw>(DETAIL_QUERY, { addrs, minDate });

  const index = new Map<string, ChainToken>();
  for (const c of token.chains) index.set(chainKey(c.chainId, c.address), c);

  const seriesByChain = new Map<number, ChainSeries>();
  for (const c of token.chains) {
    if (!seriesByChain.has(c.chainId)) {
      seriesByChain.set(c.chainId, { chainId: c.chainId, totalSupply: null, days: [] });
    }
  }

  for (const tok of data.Token) {
    const dep = index.get(chainKey(tok.chainId, tok.address));
    if (!dep) continue;
    const s = seriesByChain.get(tok.chainId)!;
    s.totalSupply = (s.totalSupply ?? 0) + formatUnits(tok.totalSupply, dep.decimals);
  }

  for (const d of data.TokenDayData) {
    const dep = index.get(chainKey(d.chainId, d.token.address));
    if (!dep) continue;
    seriesByChain.get(d.chainId)!.days.push(toDay(d, dep.decimals));
  }

  const byChain: ChainSeries[] = [];
  for (const s of seriesByChain.values()) {
    // A chain may carry several deployments (e.g. native USDC + bridged USDC.e),
    // so collapse duplicate dates by summing.
    s.days = mergeByDate(s.days);
    byChain.push(s);
  }
  byChain.sort((a, b) => (b.totalSupply ?? 0) - (a.totalSupply ?? 0));

  const totalSupply = byChain.reduce<number | null>((acc, s) => {
    if (s.totalSupply == null) return acc;
    return (acc ?? 0) + s.totalSupply;
  }, null);

  return { totalSupply, days: aggregateDays(byChain), byChain };
}

/** Sum per-day metrics across a list of (possibly duplicate-dated) days. */
function mergeByDate(days: TokenDay[]): TokenDay[] {
  const acc = new Map<number, TokenDay>();
  for (const d of days) {
    const cur = acc.get(d.date);
    if (!cur) {
      acc.set(d.date, { ...d });
    } else {
      cur.dailyTransferAmount += d.dailyTransferAmount;
      cur.dailyTransferCount += d.dailyTransferCount;
      cur.dailyMintAmount += d.dailyMintAmount;
      cur.dailyBurnAmount += d.dailyBurnAmount;
    }
  }
  return [...acc.values()].sort((a, b) => a.date - b.date);
}

/** Sum every chain's per-day metrics into a single aggregate series. */
function aggregateDays(byChain: ChainSeries[]): TokenDay[] {
  return mergeByDate(byChain.flatMap((s) => s.days));
}

/** Assemble a coarse 7-day TokenStats from the sidebar's per-chain map, for an
 *  instant render while the full 365-day detail loads. */
export function assembleFromChainStats(token: Token, map: ChainStatsMap): TokenStats {
  // Group every deployment by chain, summing those that share a chain
  // (e.g. native USDC + bridged USDC.e on the same network).
  const grouped = new Map<number, ChainSeries>();
  for (const c of token.chains) {
    const s = map[chainKey(c.chainId, c.address)];
    if (!s) continue;
    const cur = grouped.get(c.chainId);
    if (!cur) {
      grouped.set(c.chainId, { chainId: c.chainId, totalSupply: s.totalSupply, days: [...s.days] });
    } else {
      if (s.totalSupply != null) cur.totalSupply = (cur.totalSupply ?? 0) + s.totalSupply;
      cur.days.push(...s.days);
    }
  }

  const byChain: ChainSeries[] = [];
  for (const s of grouped.values()) {
    s.days = mergeByDate(s.days);
    byChain.push(s);
  }
  byChain.sort((a, b) => (b.totalSupply ?? 0) - (a.totalSupply ?? 0));
  const totalSupply = byChain.reduce<number | null>((acc, s) => {
    if (s.totalSupply == null) return acc;
    return (acc ?? 0) + s.totalSupply;
  }, null);
  return { totalSupply, days: aggregateDays(byChain), byChain };
}

export type Timeframe = "weekly" | "monthly" | "yearly";

export function timeframeLen(t: Timeframe): number {
  return t === "weekly" ? 7 : t === "monthly" ? 30 : 365;
}

export function aggregateByTimeframe(days: TokenDay[], t: Timeframe): TokenDay[] {
  const sorted = [...days].sort((a, b) => a.date - b.date);
  return sorted.slice(-timeframeLen(t));
}

/** The set of dates (unix secs) that fall in the selected timeframe window. */
export function timeframeDates(aggregateDaysList: TokenDay[], t: Timeframe): number[] {
  return aggregateByTimeframe(aggregateDaysList, t).map((d) => d.date);
}
