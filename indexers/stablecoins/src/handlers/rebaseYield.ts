import { type EvmOnEventContext } from "envio";

// Rebase-yield funds (BENJI/iBENJI, BUIDL/BUIDL-I, WTGXX, FDIT). NAV per share is
// pinned at $1.00; yield is paid as new shares minted to every holder
// (`balance * r`, r identical for all). We recover the per-share period rate r at
// the dividend mint as `mint / priorBalance`, and confirm a real distribution
// only when >=2 same-day zero-address mints share that ratio — a lone
// subscription mint has no matching partner, so it is excluded. BENJI distributes
// daily, BUIDL/WTGXX/FDIT ~monthly; periodDays (gap since the previous
// distribution) makes the annualisation cadence-agnostic.

const DAY = 86400;
const SCALE = 1_000_000_000_000_000_000n; // 1e18
const DAYS_PER_YEAR = 365n;
const WINDOW_DAYS = 7;

type TokenInfo = { symbol: string; decimals: number };

// Every rebase-fund token address across chains (lowercased) -> symbol + decimals.
const TOKENS: Record<string, TokenInfo> = {
  // BENJI — Franklin OnChain US Government Money Fund (FOBXX)
  "0x3ddc84940ab509c11b20b76b466933f40b750dc9": { symbol: "BENJI", decimals: 18 },
  "0x408a634b8a8f0de729b48574a3a7ec3fe820b00a": { symbol: "BENJI", decimals: 18 },
  "0x60cfc2b186a4cf647486e42c42b11cc6d571d1e4": { symbol: "BENJI", decimals: 18 },
  "0xb9e4765bce2609bc1949592059b17ea72fee6c6a": { symbol: "BENJI", decimals: 18 },
  "0xe08b4c1005603427420e64252a8b120cace4d122": { symbol: "BENJI", decimals: 18 },
  // iBENJI — institutional share class
  "0x90276e9d4a023b5229e0c2e9d4b2a83fe3a2b48c": { symbol: "iBENJI", decimals: 18 },
  "0x3d0a2a3a30a43a2c1c4b92033609245e819ae6a6": { symbol: "iBENJI", decimals: 18 },
  // BUIDL — BlackRock USD Institutional Digital Liquidity Fund
  "0x7712c34205737192402172409a8f7ccef8aa2aec": { symbol: "BUIDL", decimals: 6 },
  "0xa1cdab15bba75a80df4089cafba013e376957cf5": { symbol: "BUIDL", decimals: 6 },
  "0x2d5bdc96d9c8aabbdb38c9a27398513e7e5ef84f": { symbol: "BUIDL", decimals: 6 },
  "0x2893ef551b6dd69f661ac00f11d93e5dc5dc0e99": { symbol: "BUIDL", decimals: 6 },
  "0xa6525ae43edcd03dc08e775774dcabd3bb925872": { symbol: "BUIDL", decimals: 6 },
  "0x53fc82f14f009009b440a706e31c9021e1196a2f": { symbol: "BUIDL", decimals: 6 },
  // BUIDL-I — BUIDL institutional sub-class
  "0x6a9da2d710bb9b700acde7cb81f10f1ff8c89041": { symbol: "BUIDL-I", decimals: 6 },
  // WTGXX — WisdomTree Government Money Market Digital Fund
  "0x1fecf3d9d4fee7f2c02917a66028a48c6706c179": { symbol: "WTGXX", decimals: 18 },
  "0x870fd36b3bf7f5abeeea2c8d4abdf1dc4e33109d": { symbol: "WTGXX", decimals: 18 },
  "0x5096b85ed11798fddcb8b5cb27c399c04689c435": { symbol: "WTGXX", decimals: 18 },
  "0xfeb26f0943c3885b2cb85a9f933975356c81c33d": { symbol: "WTGXX", decimals: 18 },
  "0xcf7a8813bd3bdaf70a9f46d310ce1ee8d80a4f5a": { symbol: "WTGXX", decimals: 18 },
  // FDIT — Fidelity Treasury Digital Fund (FYOXX)
  "0x48ab4e39ac59f4e88974804b04a991b3a402717f": { symbol: "FDIT", decimals: 18 },
};

const info = (tokenAddress: string): TokenInfo | undefined => TOKENS[tokenAddress.toLowerCase()];

export const isRebase = (tokenAddress: string): boolean => info(tokenAddress) !== undefined;

const midnight = (ts: number): number => Math.floor(ts / DAY) * DAY;

// 10^decimals: $1.00 in the token's fixed-point.
const pow10 = (n: number): bigint => 10n ** BigInt(n);

// Two ratios count as the same distribution when within 0.1% of each other.
// Per-holder integer truncation makes small holders' ratios slightly noisier;
// 0.1% comfortably groups a genuine dividend run while excluding subscriptions.
const matches = (r: bigint, cand: bigint): boolean => {
  if (cand <= 0n) return false;
  const diff = r > cand ? r - cand : cand - r;
  return diff * 1000n <= cand;
};

// NAV is constant $1.00 for these funds. Write/refresh the day's NavDailySnapshot
// straight from a transfer so the dashboard has a NAV series alongside yield.
export function writeDollarSnapshot(
  context: EvmOnEventContext,
  chainId: number,
  tokenAddress: string,
  timestamp: number,
): void {
  const t = info(tokenAddress);
  if (!t) return;
  const day = midnight(timestamp);
  context.NavDailySnapshot.set({
    id: `${chainId}_${tokenAddress}_${day}`,
    chainId,
    oracle: tokenAddress,
    token: t.symbol,
    date: day,
    nav: pow10(t.decimals),
    decimals: t.decimals,
  });
}

type YieldMint = {
  context: EvmOnEventContext;
  chainId: number;
  tokenAddress: string;
  amount: bigint; // dividend mint amount (shares)
  priorBalance: bigint; // recipient balance before this mint
  sharesOutstanding: bigint; // totalSupply right after this mint
  timestamp: number;
};

// Recompute the trailing-7-day APY and week-over-week change, then write the
// RebaseYield row for `day`. Called on confirmation and on each later matching
// mint (so sharesDistributed stays current).
async function writeYieldDay(
  context: EvmOnEventContext,
  chainId: number,
  tokenAddress: string,
  token: string,
  day: number,
  periodDays: number,
  periodYield: bigint,
  sharesDistributed: bigint,
  sharesOutstanding: bigint,
): Promise<void> {
  const annualizedYield = periodDays > 0 ? (periodYield * DAYS_PER_YEAR) / BigInt(periodDays) : 0n;

  // Trailing window: this distribution's annualised yield plus the up-to-6 prior
  // days already stored. Average only days that carry an annualised value (>0),
  // so first-distribution placeholders and empty days don't drag it down.
  const priorDays = await Promise.all(
    Array.from({ length: WINDOW_DAYS - 1 }, (_, i) =>
      context.RebaseYield.get(`${chainId}_${tokenAddress}_${day - (i + 1) * DAY}`),
    ),
  );

  let sum = annualizedYield;
  let count = annualizedYield > 0n ? 1 : 0;
  for (const d of priorDays) {
    if (d && d.annualizedYield > 0n) {
      sum += d.annualizedYield;
      count += 1;
    }
  }
  const trailingApy = count > 0 ? sum / BigInt(count) : 0n;

  const weekAgo = await context.RebaseYield.get(
    `${chainId}_${tokenAddress}_${day - WINDOW_DAYS * DAY}`,
  );
  const wowChange = trailingApy - (weekAgo?.trailingApy ?? 0n);

  context.RebaseYield.set({
    id: `${chainId}_${tokenAddress}_${day}`,
    chainId,
    token,
    tokenAddress,
    date: day,
    periodDays,
    periodYield,
    annualizedYield,
    trailingApy,
    wowChange,
    sharesDistributed,
    sharesOutstanding,
  });
}

export async function recordYieldMint(p: YieldMint): Promise<void> {
  const t = info(p.tokenAddress);
  if (t === undefined) return;
  if (p.priorBalance <= 0n) return; // new investor: no ratio to derive

  const r = (p.amount * SCALE) / p.priorBalance;
  const day = midnight(p.timestamp);
  const stateId = `${p.chainId}_${p.tokenAddress}`;
  const prev = await p.context.RebaseYieldState.get(stateId);

  // Fresh day (or first ever): seed candidate A, nothing to confirm yet. Carry
  // the previous distribution day forward so periodDays can be computed later.
  if (!prev || prev.openDay !== day) {
    p.context.RebaseYieldState.set({
      id: stateId,
      chainId: p.chainId,
      token: t.symbol,
      tokenAddress: p.tokenAddress,
      openDay: day,
      confirmedDay: prev?.confirmedDay ?? -1,
      lastDistDay: prev?.lastDistDay ?? 0,
      curPeriodDays: prev?.curPeriodDays ?? 0,
      candRateA: r,
      candCountA: 1,
      candSharesA: p.amount,
      candRateB: 0n,
      candCountB: 0,
      candSharesB: 0n,
    });
    return;
  }

  // Same day: slot the ratio into candidate A or B.
  const s = { ...prev };
  if (s.candCountA > 0 && matches(r, s.candRateA)) {
    s.candCountA += 1;
    s.candSharesA += p.amount;
  } else if (s.candCountB > 0 && matches(r, s.candRateB)) {
    s.candCountB += 1;
    s.candSharesB += p.amount;
  } else if (s.candCountA === 0) {
    s.candRateA = r;
    s.candCountA = 1;
    s.candSharesA = p.amount;
  } else if (s.candCountB === 0) {
    s.candRateB = r;
    s.candCountB = 1;
    s.candSharesB = p.amount;
  } else {
    // Both slots taken by other ratios — treat as an unrelated mint.
    p.context.RebaseYieldState.set(s);
    return;
  }

  // The first candidate to reach 2 matches is the confirmed distribution; once
  // confirmed, keep refreshing its row as more matching mints arrive.
  let rate = 0n;
  let shares = 0n;
  if (s.candCountA >= 2) {
    rate = s.candRateA;
    shares = s.candSharesA;
  } else if (s.candCountB >= 2) {
    rate = s.candRateB;
    shares = s.candSharesB;
  }

  if (rate > 0n) {
    if (s.confirmedDay !== day) {
      // First confirmation today: periodDays = gap since the previous
      // distribution; then this day becomes the previous one for next time.
      s.curPeriodDays = s.lastDistDay > 0 ? Math.max(1, (day - s.lastDistDay) / DAY) : 0;
      s.lastDistDay = day;
      s.confirmedDay = day;
    }
    await writeYieldDay(
      p.context,
      p.chainId,
      p.tokenAddress,
      t.symbol,
      day,
      s.curPeriodDays,
      rate,
      shares,
      p.sharesOutstanding,
    );
  }

  p.context.RebaseYieldState.set(s);
}
