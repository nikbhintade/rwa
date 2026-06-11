import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

const CHAIN_ID = 1;
const DAY = 86400;

const BENJI = "0x3ddc84940ab509c11b20b76b466933f40b750dc9" as `0x${string}`;
const BUIDL = "0x7712c34205737192402172409a8f7ccef8aa2aec" as `0x${string}`;
const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const A = "0x00000000000000000000000000000000000000a1" as `0x${string}`;
const B = "0x00000000000000000000000000000000000000b2" as `0x${string}`;

const D0_MID = 1_699_920_000;
const NOON = 43_200;

function transfer(
  src: `0x${string}`,
  from: `0x${string}`,
  to: `0x${string}`,
  value: bigint,
  ts: number,
  block: number,
  log: number,
) {
  return {
    contract: "Treasuries" as const,
    event: "Transfer" as const,
    params: { from, to, value },
    block: { number: block, timestamp: ts },
    logIndex: log,
    srcAddress: src,
  };
}

describe("Rebase-yield funds", () => {
  it("BENJI (daily): periodDays=1, annualizes the daily rate, writes $1.00 NAV snapshot", async () => {
    const indexer = createTestIndexer();
    const seedTs = D0_MID + NOON;
    const d1Ts = D0_MID + DAY + NOON;
    const d2Ts = D0_MID + 2 * DAY + NOON;
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            transfer(BENJI, ZERO, A, 1_000_000n, seedTs, 100, 0), // subscriptions (prior 0 -> skipped)
            transfer(BENJI, ZERO, B, 2_000_000n, seedTs, 100, 1),
            transfer(BENJI, ZERO, A, 10_000n, d1Ts, 200, 0), // r = 1e16 (0.01/day)
            transfer(BENJI, ZERO, B, 20_000n, d1Ts, 200, 1),
            transfer(BENJI, ZERO, A, 10_100n, d2Ts, 300, 0), // prior 1_010_000 -> r = 1e16
            transfer(BENJI, ZERO, B, 20_200n, d2Ts, 300, 1), // prior 2_020_000 -> r = 1e16
          ],
        },
      },
    });

    const d1 = D0_MID + DAY;
    const d2 = D0_MID + 2 * DAY;
    const y1 = await indexer.RebaseYield.get(`${CHAIN_ID}_${BENJI}_${d1}`);
    const y2 = await indexer.RebaseYield.get(`${CHAIN_ID}_${BENJI}_${d2}`);

    expect(y1?.periodDays).toBe(0); // first distribution: period unknown
    expect(y1?.periodYield).toBe(10_000_000_000_000_000n); // 0.01 * 1e18
    expect(y1?.annualizedYield).toBe(0n);

    expect(y2?.periodDays).toBe(1);
    expect(y2?.periodYield).toBe(10_000_000_000_000_000n);
    expect(y2?.annualizedYield).toBe(3_650_000_000_000_000_000n); // 0.01 * 365
    expect(y2?.trailingApy).toBe(3_650_000_000_000_000_000n); // only d2 carries an annualised value
    expect(y2?.token).toBe("BENJI");

    // $1.00 NAV snapshot written from transfers (BENJI is 18-dec).
    const navDay = await indexer.NavDailySnapshot.get(`${CHAIN_ID}_${BENJI}_${D0_MID}`);
    expect(navDay?.nav).toBe(1_000_000_000_000_000_000n);
    expect(navDay?.decimals).toBe(18);
    expect(navDay?.token).toBe("BENJI");
  });

  it("BUIDL (monthly): annualizes by the 30-day gap, writes $1.00 (6-dec) snapshot", async () => {
    const indexer = createTestIndexer();
    const seedTs = D0_MID + NOON;
    const d1Ts = D0_MID + DAY + NOON;
    const d2Ts = d1Ts + 30 * DAY;
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            transfer(BUIDL, ZERO, A, 1_000_000n, seedTs, 100, 0),
            transfer(BUIDL, ZERO, B, 2_000_000n, seedTs, 100, 1),
            transfer(BUIDL, ZERO, A, 3_000n, d1Ts, 200, 0), // r = 3e15 (0.003)
            transfer(BUIDL, ZERO, B, 6_000n, d1Ts, 200, 1),
            transfer(BUIDL, ZERO, A, 3_009n, d2Ts, 300, 0), // prior 1_003_000 -> r = 3e15
            transfer(BUIDL, ZERO, B, 6_018n, d2Ts, 300, 1), // prior 2_006_000 -> r = 3e15
          ],
        },
      },
    });

    const d2 = D0_MID + 31 * DAY;
    const y2 = await indexer.RebaseYield.get(`${CHAIN_ID}_${BUIDL}_${d2}`);
    expect(y2?.periodDays).toBe(30);
    expect(y2?.periodYield).toBe(3_000_000_000_000_000n); // 0.003 * 1e18
    expect(y2?.annualizedYield).toBe(36_500_000_000_000_000n); // 0.003 * 365 / 30 = 0.0365
    expect(y2?.token).toBe("BUIDL");

    const navDay = await indexer.NavDailySnapshot.get(`${CHAIN_ID}_${BUIDL}_${D0_MID}`);
    expect(navDay?.nav).toBe(1_000_000n); // $1.00 at 6 decimals
    expect(navDay?.decimals).toBe(6);
  });

  it("does not confirm when same-day mints have differing ratios", async () => {
    const indexer = createTestIndexer();
    const seedTs = D0_MID + NOON;
    const d1Ts = D0_MID + DAY + NOON;
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            transfer(BENJI, ZERO, A, 1_000_000n, seedTs, 100, 0),
            transfer(BENJI, ZERO, B, 2_000_000n, seedTs, 100, 1),
            transfer(BENJI, ZERO, A, 10_000n, d1Ts, 200, 0), // r = 1e16
            transfer(BENJI, ZERO, B, 50_000n, d1Ts, 200, 1), // r = 2.5e16 -> no match
          ],
        },
      },
    });
    const y = await indexer.RebaseYield.get(`${CHAIN_ID}_${BENJI}_${D0_MID + DAY}`);
    expect(y).toBeUndefined();
  });
});
