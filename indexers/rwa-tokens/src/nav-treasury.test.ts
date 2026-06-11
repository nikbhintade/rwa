import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

const CHAIN_ID = 1;
const DAY = 86400;

const CUMIU = "0x85d38585c3ac08268f598282a84b7c0ddfc0d04f" as `0x${string}`;
const USTB_ORACLE = "0xe4fa682f94610ccd170680cc3b045d77d9e528a8" as `0x${string}`;
const USTBL_FEED = "0xc1c24f0f2103f5899b7ab415a1930e519b7d3423" as `0x${string}`;
const USDY = "0x96f6ef951840721adbf46ac996b59e0235cb985c" as `0x${string}`;

// Noon on a UTC-midnight-aligned day, so the two following midnights are easy to reason about.
const T0 = 1_699_963_200; // day D0, 12:00 UTC (midnight = 1_699_920_000)
const D0_MID = 1_699_920_000;

function answerUpdated(current: bigint, roundId: bigint, updatedAt: number, block: number, log: number) {
  return {
    contract: "UstblNavFeed" as const,
    event: "AnswerUpdated" as const,
    params: { current, roundId, updatedAt: BigInt(updatedAt) },
    block: { number: block, timestamp: updatedAt },
    logIndex: log,
    srcAddress: USTBL_FEED,
  };
}

function newCheckpoint(navs: bigint, effectiveAt: number, block: number, log: number) {
  return {
    contract: "UstbNavOracle" as const,
    event: "NewCheckpoint" as const,
    params: { timestamp: BigInt(effectiveAt), effectiveAt: BigInt(effectiveAt), navs },
    block: { number: block, timestamp: effectiveAt },
    logIndex: log,
    srcAddress: USTB_ORACLE,
  };
}

function updatedNav(newNAV: bigint, src: `0x${string}`, ts: number, block: number, log: number) {
  return {
    contract: "Treasuries" as const,
    event: "updatedNAV" as const,
    params: { epoch: 1n, previousNAV: 0n, newNAV },
    block: { number: block, timestamp: ts },
    logIndex: log,
    srcAddress: src,
  };
}

describe("Treasury NAV & yield", () => {
  it("USTBL (step): records each NAV change, derives annualised yield, fills midnight snapshots", async () => {
    const indexer = createTestIndexer();
    const t2 = T0 + 2 * DAY; // +2 days
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            answerUpdated(1_000_000n, 1n, T0, 100, 0), // $1.000000
            answerUpdated(1_000_300n, 2n, t2, 200, 0), // $1.000300
          ],
        },
      },
    });

    // First update: no prior NAV -> yield 0, prevNav unset.
    const u1 = await indexer.NavUpdate.get(`${CHAIN_ID}_${USTBL_FEED}_100_0`);
    expect(u1?.nav).toBe(1_000_000n);
    expect(u1?.yieldPerAnnum).toBe(0n);
    expect(u1?.prevNav).toBeUndefined();

    // Second update: +0.03% over 2 days -> simple annualised yield, 1e18-scaled.
    // growth = 300/1e6 = 3e-4; annualised = 3e-4 * 365/2 = 0.05475
    const u2 = await indexer.NavUpdate.get(`${CHAIN_ID}_${USTBL_FEED}_200_0`);
    expect(u2?.prevNav).toBe(1_000_000n);
    expect(u2?.yieldPerAnnum).toBe(54_750_000_000_000_000n); // 0.05475 * 1e18

    // Step oracle: both crossed midnights snapshot the NAV that was effective then ($1.000000).
    const day1 = await indexer.NavDailySnapshot.get(`${CHAIN_ID}_${USTBL_FEED}_${D0_MID + DAY}`);
    const day2 = await indexer.NavDailySnapshot.get(`${CHAIN_ID}_${USTBL_FEED}_${D0_MID + 2 * DAY}`);
    expect(day1?.nav).toBe(1_000_000n);
    expect(day2?.nav).toBe(1_000_000n);
    expect(day1?.decimals).toBe(6);

    const state = await indexer.NavOracleState.get(`${CHAIN_ID}_${USTBL_FEED}`);
    expect(state?.latestNav).toBe(1_000_300n);
    expect(state?.lastSnapshotDay).toBe(D0_MID + 2 * DAY);
  });

  it("USTB (linear): interpolates NAV at each midnight between checkpoints", async () => {
    const indexer = createTestIndexer();
    const t2 = T0 + 2 * DAY;
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            newCheckpoint(11_000_000n, T0, 100, 0), // $11.000000
            newCheckpoint(11_002_000n, t2, 200, 0), // $11.002000, +2000 over 2 days
          ],
        },
      },
    });

    // day1 midnight is 1/4 of the way from T0 to t2 -> +500; day2 is 3/4 -> +1500.
    const day1 = await indexer.NavDailySnapshot.get(`${CHAIN_ID}_${USTB_ORACLE}_${D0_MID + DAY}`);
    const day2 = await indexer.NavDailySnapshot.get(`${CHAIN_ID}_${USTB_ORACLE}_${D0_MID + 2 * DAY}`);
    expect(day1?.nav).toBe(11_000_500n);
    expect(day2?.nav).toBe(11_001_500n);
  });

  it("CUMIU: tracks updatedNAV from the CUMIU address only, ignoring other Treasuries", async () => {
    const indexer = createTestIndexer();
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            updatedNav(1_033_353n, CUMIU, T0, 100, 0), // $103.3353 (1e4 fixed point)
            updatedNav(9_999_999n, USDY, T0, 100, 1), // wrong emitter -> ignored
          ],
        },
      },
    });

    const u = await indexer.NavUpdate.get(`${CHAIN_ID}_${CUMIU}_100_0`);
    expect(u?.nav).toBe(1_033_353n);
    expect(u?.token).toBe("CUMIU");
    expect(u?.decimals).toBe(4);

    // The USDY-sourced updatedNAV must not have produced a CUMIU NavUpdate.
    const state = await indexer.NavOracleState.get(`${CHAIN_ID}_${CUMIU}`);
    expect(state?.latestNav).toBe(1_033_353n);
  });
});
