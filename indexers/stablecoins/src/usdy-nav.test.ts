import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

const CHAIN_ID = 1;
const ORACLE = "0xa0219aa5b31e65bc920b5b6dfb8edf0988121de0" as `0x${string}`;
const DAY = 86400;

// Range 0 (seeded from the oracle's constructor values) — 2023-08-01..2023-09-01.
const R0_START = 1690848000;
const R0_END = 1693526400;
const DAILY_IR = 1000133680000000000000000000n;
const R0_CLOSE = 1004018180000000000n; // derivePrice(range0, end-1), verified on-chain

function rangeSet(
  index: bigint,
  start: bigint,
  end: bigint,
  dailyInterestRate: bigint,
  prevRangeClosePrice: bigint,
  timestamp: number,
) {
  return {
    contract: "USDYNavOracle" as const,
    event: "RangeSet" as const,
    params: { index, start, end, dailyInterestRate, prevRangeClosePrice },
    block: { timestamp },
    srcAddress: ORACLE,
  };
}

describe("USDY NAV", () => {
  it("seeds range 0 and reproduces on-chain NAV (day0 = $1.00)", async () => {
    const indexer = createTestIndexer();

    // Fire the first emitted range (index 1). Its handler seeds range 0 too.
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            rangeSet(
              1n,
              BigInt(R0_END),
              BigInt(R0_END + 2 * DAY),
              DAILY_IR,
              R0_CLOSE,
              R0_END,
            ),
          ],
        },
      },
    });

    // Range 0 entity seeded from the constructor constant.
    const r0 = await indexer.NavRange.get(`${CHAIN_ID}_0`);
    expect(r0?.start).toBe(BigInt(R0_START));
    expect(r0?.end).toBe(BigInt(R0_END));
    expect(r0?.overridden).toBe(false);

    // Known on-chain values: launch price is exactly 1e18, then compounds daily.
    const day0 = await indexer.NavDay.get(`${CHAIN_ID}_${R0_START}`);
    expect(day0?.price).toBe(1000000000000000000n); // $1.000000

    const day1 = await indexer.NavDay.get(`${CHAIN_ID}_${R0_START + DAY}`);
    expect(day1?.price).toBe(1000133680000000000n);

    const day30 = await indexer.NavDay.get(`${CHAIN_ID}_${R0_START + 30 * DAY}`);
    expect(day30?.price).toBe(1004018180000000000n);

    // The boundary timestamp (range0.end) belongs to range 1, not range 0.
    const boundary = await indexer.NavDay.get(`${CHAIN_ID}_${R0_END}`);
    expect(boundary?.rangeIndex).toBe(1);
  });

  it("range 1 day 0 grows one day off its prevRangeClosePrice", async () => {
    const indexer = createTestIndexer();
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            rangeSet(1n, BigInt(R0_END), BigInt(R0_END + 2 * DAY), DAILY_IR, R0_CLOSE, R0_END),
          ],
        },
      },
    });

    const r1day0 = await indexer.NavDay.get(`${CHAIN_ID}_${R0_END}`);
    // price = roundUpTo8(R0_CLOSE * DAILY_IR / 1e27)
    expect(r1day0?.price).toBe(1004152400000000000n);
  });
});
