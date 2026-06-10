import { indexer, type EvmOnEventContext } from "envio";

// USDY NAV — Ondo RWADynamicOracle (0xA0219AA5B31e65Bc920B5b6DFb8EdF0988121De0).
//
// The oracle defines NAV as a piecewise curve. Each "range" carries a daily
// compounding rate; the price for elapsed day `d` of a range is
//   roundUpTo8( rmul( rpow(dailyInterestRate, d + 1, ONE), prevRangeClosePrice ) )
// This reproduces the contract's getPrice / getPriceHistorical exactly (verified
// against on-chain reads). Because price accrues by formula and only the range
// schedule emits events (RangeSet / RangeOverriden, ~monthly), we materialise
// the daily NAV series from the range parameters rather than reading per block.

const ORACLE = "0xa0219aa5b31e65bc920b5b6dfb8edf0988121de0";
const DAY = 86400n;
const ONE = 10n ** 27n; // RAY, fixed-point base for rates
const E10 = 10n ** 10n; // 8-dec rounding granularity within an 18-dec number

// Range 0 is created in the oracle's constructor and emits no RangeSet, so it
// cannot be reconstructed from events. Seed it from its (immutable) on-chain
// values so the NAV series starts at USDY's launch (2023-08-01 = $1.00).
const RANGE0 = {
  start: 1690848000n, // 2023-08-01T00:00:00Z
  end: 1693526400n, // 2023-09-01T00:00:00Z
  dailyInterestRate: 1000133680000000000000000000n,
  prevRangeClosePrice: 999866337867953811n,
};

// Hard cap on days materialised per range — guards against a malformed range
// span causing an unbounded loop. ~11 years; real ranges are ~monthly.
const MAX_DAYS_PER_RANGE = 4096;

/** MakerDAO dss rpow: x^n in `base` fixed-point, with round-half-up per step. */
function rpow(x: bigint, n: bigint, base: bigint): bigint {
  let z: bigint;
  if (x === 0n) {
    z = n === 0n ? base : 0n;
  } else {
    z = n % 2n === 0n ? base : x;
    const half = base / 2n;
    for (n = n / 2n; n > 0n; n = n / 2n) {
      const xx = x * x;
      x = (xx + half) / base;
      if (n % 2n === 1n) {
        const zx = z * x;
        z = (zx + half) / base;
      }
    }
  }
  return z;
}

const rmul = (x: bigint, y: bigint): bigint => (x * y) / ONE;

/** Round to 8 decimals (round-half-up at 0.5e10), matching the oracle. */
function roundUpTo8(value: bigint): bigint {
  const remainder = value % E10;
  if (remainder >= 5n * 10n ** 9n) value += E10;
  return value - remainder;
}

/** NAV (18-dec) at `elapsedDays` into a range. */
function priceForDay(dailyInterestRate: bigint, prevRangeClosePrice: bigint, elapsedDays: bigint): bigint {
  return roundUpTo8(rmul(rpow(dailyInterestRate, elapsedDays + 1n, ONE), prevRangeClosePrice));
}

/** Write one NavDay per elapsed day of a range, [start, end) on the DAY grid. */
function writeRangeDays(
  context: EvmOnEventContext,
  chainId: number,
  rangeIndex: number,
  start: bigint,
  end: bigint,
  dailyInterestRate: bigint,
  prevRangeClosePrice: bigint,
): void {
  let d = 0n;
  for (let date = start; date < end && d < BigInt(MAX_DAYS_PER_RANGE); date += DAY, d += 1n) {
    const dateNum = Number(date);
    context.NavDay.set({
      id: `${chainId}_${dateNum}`,
      chainId,
      oracle: ORACLE,
      rangeIndex,
      date: dateNum,
      price: priceForDay(dailyInterestRate, prevRangeClosePrice, d),
    });
  }
}

/** Upsert a NavRange and (re)materialise its daily NAV series. */
async function upsertRange(
  context: EvmOnEventContext,
  chainId: number,
  rangeIndex: number,
  start: bigint,
  end: bigint,
  dailyInterestRate: bigint,
  prevRangeClosePrice: bigint,
  overridden: boolean,
  updatedAt: bigint,
): Promise<void> {
  // On an override the date span can shift, so clear this range's old days first.
  if (overridden) {
    const stale = await context.NavDay.getWhere({ rangeIndex: { _eq: rangeIndex } });
    for (const day of stale) {
      if (day.chainId === chainId) context.NavDay.deleteUnsafe(day.id);
    }
  }

  context.NavRange.set({
    id: `${chainId}_${rangeIndex}`,
    chainId,
    oracle: ORACLE,
    rangeIndex,
    start,
    end,
    dailyInterestRate,
    prevRangeClosePrice,
    overridden,
    updatedAt,
  });

  writeRangeDays(context, chainId, rangeIndex, start, end, dailyInterestRate, prevRangeClosePrice);
}

/** Seed range 0 (constructor-created, eventless) once, before any later range. */
async function ensureRange0(context: EvmOnEventContext, chainId: number, updatedAt: bigint): Promise<void> {
  const existing = await context.NavRange.get(`${chainId}_0`);
  if (existing) return;
  await upsertRange(
    context,
    chainId,
    0,
    RANGE0.start,
    RANGE0.end,
    RANGE0.dailyInterestRate,
    RANGE0.prevRangeClosePrice,
    false,
    updatedAt,
  );
}

indexer.onEvent(
  { contract: "USDYNavOracle", event: "RangeSet" },
  async ({ event, context }) => {
    const { index, start, end, dailyInterestRate, prevRangeClosePrice } = event.params;
    const chainId = event.chainId;
    const updatedAt = BigInt(event.block.timestamp);

    await ensureRange0(context, chainId, updatedAt);
    await upsertRange(
      context,
      chainId,
      Number(index),
      start,
      end,
      dailyInterestRate,
      prevRangeClosePrice,
      false,
      updatedAt,
    );
  },
);

indexer.onEvent(
  { contract: "USDYNavOracle", event: "RangeOverriden" },
  async ({ event, context }) => {
    const { index, newStart, newEnd, newDailyInterestRate, newPrevRangeClosePrice } = event.params;
    const chainId = event.chainId;
    const updatedAt = BigInt(event.block.timestamp);
    const rangeIndex = Number(index);

    // overrideRange stores prevRangeClosePrice verbatim — except for index 0,
    // where the contract derives it as newPrevRangeClosePrice * ONE / newDailyIR.
    const prevClose =
      rangeIndex === 0
        ? (newPrevRangeClosePrice * ONE) / newDailyInterestRate
        : newPrevRangeClosePrice;

    await ensureRange0(context, chainId, updatedAt);
    await upsertRange(
      context,
      chainId,
      rangeIndex,
      newStart,
      newEnd,
      newDailyInterestRate,
      prevClose,
      true,
      updatedAt,
    );
  },
);
