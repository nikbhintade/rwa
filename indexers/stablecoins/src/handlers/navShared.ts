import { type EvmOnEventContext } from "envio";

// Shared NAV + yield tracking for treasury tokens (CUMIU, USTB, USTBL).
//
// Three entities are produced:
//   - NavUpdate        one row per oracle update (every NAV change)
//   - NavDailySnapshot NAV at 00:00 UTC, one row per oracle per day
//   - NavOracleState   per-oracle singleton holding the latest NAV + backfill cursor
//
// Step oracles (CUMIU, USTBL) hold a NAV constant until the next update, so the
// midnight snapshot is just the NAV that was effective then. USTB emits sparse
// checkpoints between which NAV grows linearly, so its midnights are interpolated.
// Either way the daily series is materialised by backfilling, on each update, the
// midnights between the previous update and this one — meaning the current day is
// written once the next update arrives (<=1 day tail lag).

export const DAY = 86400;
const YEAR = 31536000n; // 365 days
const YIELD_SCALE = 1_000_000_000_000_000_000n; // 1e18

export type NavMode = "step" | "linear";

/** UTC-midnight of a unix-seconds timestamp. */
export const midnight = (ts: bigint): number => Math.floor(Number(ts) / DAY) * DAY;

/**
 * Simple (non-compounded) annualised yield from `prevNav`->`nav` over `dtSecs`,
 * scaled by 1e18. Returns 0 when there is no usable previous point.
 */
export function annualizedYield(prevNav: bigint, nav: bigint, dtSecs: bigint): bigint {
  if (prevNav <= 0n || dtSecs <= 0n) return 0n;
  const growth = ((nav - prevNav) * YIELD_SCALE) / prevNav; // 1e18-scaled change over dt
  return (growth * YEAR) / dtSecs;
}

/** Linear NAV at time `at` between anchors (t0, n0) and (t1, n1). */
function interpolate(t0: bigint, n0: bigint, t1: bigint, n1: bigint, at: bigint): bigint {
  if (t1 <= t0) return n1;
  return n0 + ((n1 - n0) * (at - t0)) / (t1 - t0);
}

export type NavInput = {
  context: EvmOnEventContext;
  chainId: number;
  oracle: string; // lowercased address
  token: string; // e.g. "USTB"
  decimals: number; // NAV fixed-point decimals
  nav: bigint; // new NAV
  updatedAt: bigint; // NAV timestamp (seconds)
  mode: NavMode;
  blockNumber: number;
  blockTimestamp: number;
  logIndex: number;
  roundId?: bigint; // Chainlink feeds only
};

/** Record a NAV update, derive its yield, and backfill midnight snapshots. */
export async function recordNav(p: NavInput): Promise<void> {
  const { context, chainId, oracle, token, decimals, nav, updatedAt, mode } = p;
  const stateId = `${chainId}_${oracle}`;
  const state = await context.NavOracleState.get(stateId);

  const prevNav = state?.latestNav;
  const prevUpdatedAt = state?.latestUpdatedAt;
  const yieldPerAnnum =
    prevNav !== undefined && prevUpdatedAt !== undefined
      ? annualizedYield(prevNav, nav, updatedAt - prevUpdatedAt)
      : 0n;

  context.NavUpdate.set({
    id: `${chainId}_${oracle}_${p.blockNumber}_${p.logIndex}`,
    chainId,
    oracle,
    token,
    nav,
    decimals,
    prevNav,
    yieldPerAnnum,
    roundId: p.roundId,
    updatedAt,
    date: midnight(updatedAt),
    blockNumber: p.blockNumber,
    blockTimestamp: p.blockTimestamp,
  });

  // Backfill 00:00 UTC snapshots for every midnight strictly between the last
  // filled day and this update. First-ever update has no prior NAV, so it only
  // seeds the cursor at its own midnight (which precedes the update).
  let lastDay = state ? state.lastSnapshotDay : midnight(updatedAt);
  if (state && prevNav !== undefined && prevUpdatedAt !== undefined) {
    const until = Number(updatedAt);
    for (let m = lastDay + DAY; m < until; m += DAY) {
      const navAtM =
        mode === "step" ? prevNav : interpolate(prevUpdatedAt, prevNav, updatedAt, nav, BigInt(m));
      context.NavDailySnapshot.set({
        id: `${chainId}_${oracle}_${m}`,
        chainId,
        oracle,
        token,
        date: m,
        nav: navAtM,
        decimals,
      });
      lastDay = m;
    }
  }

  context.NavOracleState.set({
    id: stateId,
    chainId,
    oracle,
    token,
    decimals,
    latestNav: nav,
    latestUpdatedAt: updatedAt,
    lastSnapshotDay: lastDay,
  });
}
