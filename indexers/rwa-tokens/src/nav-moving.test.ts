import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

const CHAIN_ID = 1;
const DAY = 86400;

const OUSG_ORACLE = "0x0502c5ae08e7cd64fe1aeda7d6e229413ecc6abe" as `0x${string}`;
const JTRSY_PM = "0x91808b5e2f6d7483d41a681034d7c9dbb64b9e29" as `0x${string}`;
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" as `0x${string}`;

const POOL_ID = 4139849551n; // 0xf6bd674f
const TRANCHE = "0x97aa65f23e7be09fcd62d0554d2e9273";

const D0_MID = 1_699_920_000;
const T0 = D0_MID + 43_200; // noon

function ousgPriceSet(newRWAPrice: bigint, ts: number, block: number, log: number) {
  return {
    contract: "OusgOracle" as const,
    event: "RWAExternalComparisonCheckPriceSet" as const,
    params: {
      oldChainlinkPrice: 0n,
      oldRoundId: 0n,
      newChainlinkPrice: 0n,
      newRoundId: 0n,
      oldRWAPrice: 0n,
      newRWAPrice,
    },
    block: { number: block, timestamp: ts },
    logIndex: log,
    srcAddress: OUSG_ORACLE,
  };
}

function priceUpdate(
  poolId: bigint,
  trancheId: string,
  price: bigint,
  computedAt: number,
  block: number,
  log: number,
) {
  return {
    contract: "JtrsyPoolManager" as const,
    event: "PriceUpdate" as const,
    params: { poolId, trancheId, asset: USDC, price, computedAt: BigInt(computedAt) },
    block: { number: block, timestamp: computedAt },
    logIndex: log,
    srcAddress: JTRSY_PM,
  };
}

describe("Moving-NAV oracles", () => {
  it("OUSG: records each NAV update and backfills step midnight snapshots", async () => {
    const indexer = createTestIndexer();
    const t2 = T0 + 2 * DAY;
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            ousgPriceSet(115_000_000_000_000_000_000n, T0, 100, 0), // $115.00
            ousgPriceSet(115_500_000_000_000_000_000n, t2, 200, 0), // $115.50
          ],
        },
      },
    });

    const u1 = await indexer.NavUpdate.get(`${CHAIN_ID}_${OUSG_ORACLE}_100_0`);
    expect(u1?.nav).toBe(115_000_000_000_000_000_000n);
    expect(u1?.prevNav).toBeUndefined();
    expect(u1?.yieldPerAnnum).toBe(0n);

    const u2 = await indexer.NavUpdate.get(`${CHAIN_ID}_${OUSG_ORACLE}_200_0`);
    expect(u2?.prevNav).toBe(115_000_000_000_000_000_000n);
    expect(u2?.yieldPerAnnum).toBeGreaterThan(0n);

    // Step oracle: crossed midnights snapshot the NAV effective then ($115.00).
    const d1 = await indexer.NavDailySnapshot.get(`${CHAIN_ID}_${OUSG_ORACLE}_${D0_MID + DAY}`);
    const d2 = await indexer.NavDailySnapshot.get(`${CHAIN_ID}_${OUSG_ORACLE}_${D0_MID + 2 * DAY}`);
    expect(d1?.nav).toBe(115_000_000_000_000_000_000n);
    expect(d2?.nav).toBe(115_000_000_000_000_000_000n);
    expect(d1?.token).toBe("OUSG");
  });

  it("JTRSY: filters by pool/tranche, ignores re-pushes, tracks the price", async () => {
    const indexer = createTestIndexer();
    const t2 = T0 + 2 * DAY;
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            priceUpdate(POOL_ID, TRANCHE, 1_072_000_000_000_000_000n, T0, 100, 0), // $1.072
            priceUpdate(999n, TRANCHE, 9_999_000_000_000_000_000n, T0, 110, 0), // wrong pool -> ignored
            priceUpdate(POOL_ID, TRANCHE, 1_072_000_000_000_000_000n, T0, 120, 0), // re-push (same computedAt) -> ignored
            priceUpdate(POOL_ID, TRANCHE, 1_073_000_000_000_000_000n, t2, 200, 0), // $1.073 newer
          ],
        },
      },
    });

    const u1 = await indexer.NavUpdate.get(`${CHAIN_ID}_${JTRSY_PM}_100_0`);
    expect(u1?.nav).toBe(1_072_000_000_000_000_000n);
    expect(u1?.token).toBe("JTRSY");

    // The wrong-pool and re-push events must not have produced NavUpdates.
    expect(await indexer.NavUpdate.get(`${CHAIN_ID}_${JTRSY_PM}_110_0`)).toBeUndefined();
    expect(await indexer.NavUpdate.get(`${CHAIN_ID}_${JTRSY_PM}_120_0`)).toBeUndefined();

    const u2 = await indexer.NavUpdate.get(`${CHAIN_ID}_${JTRSY_PM}_200_0`);
    expect(u2?.prevNav).toBe(1_072_000_000_000_000_000n);

    const d1 = await indexer.NavDailySnapshot.get(`${CHAIN_ID}_${JTRSY_PM}_${D0_MID + DAY}`);
    expect(d1?.nav).toBe(1_072_000_000_000_000_000n); // step backfill

    const state = await indexer.NavOracleState.get(`${CHAIN_ID}_${JTRSY_PM}`);
    expect(state?.latestNav).toBe(1_073_000_000_000_000_000n);
  });
});
