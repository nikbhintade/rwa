import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

const CHAIN_ID = 1;
const ORACLE = "0x4c48bcb2160f8e0adbf9d4f3b034f1e36d1f8b3e" as `0x${string}`;

// Real round 1 (block 17637029, 2023-07-06): price $1.00272922, AUM ~$3.64M.
const R1 = {
  roundId: 1n,
  balance: 363731152n, // 2-dec USD
  interest: 0n,
  price: 100272922n, // 8-dec NAV/token
  updatedAt: 1688673527n,
};

function balanceReported(
  r: typeof R1,
  blockNumber: number,
  logIndex: number,
  timestamp: number,
) {
  return {
    contract: "USYCOracle" as const,
    event: "BalanceReported" as const,
    params: r,
    block: { number: blockNumber, timestamp },
    logIndex,
    srcAddress: ORACLE,
  };
}

describe("USYC NAV", () => {
  it("stores a NAV report and updates the latest-state singleton", async () => {
    const indexer = createTestIndexer();
    await indexer.process({
      chains: {
        [CHAIN_ID]: { simulate: [balanceReported(R1, 17637029, 0, 1688673600)] },
      },
    });

    const report = await indexer.UsycNavReport.get(`${CHAIN_ID}_17637029_0`);
    expect(report?.price).toBe(100272922n); // $1.00272922
    expect(report?.balance).toBe(363731152n);
    expect(report?.roundId).toBe(1n);
    expect(report?.date).toBe(Math.floor(1688673527 / 86400) * 86400); // UTC midnight

    const state = await indexer.UsycOracleState.get(`${CHAIN_ID}`);
    expect(state?.latestRoundId).toBe(1n);
    expect(state?.latestPrice).toBe(100272922n);
  });

  it("advances the singleton only on a newer round", async () => {
    const indexer = createTestIndexer();
    const r2 = { roundId: 2n, balance: 363806616n, interest: 49864n, price: 100281001n, updatedAt: 1688759927n };
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            balanceReported(R1, 17637029, 0, 1688673600),
            balanceReported(r2, 17643579, 0, 1688759927),
          ],
        },
      },
    });

    const state = await indexer.UsycOracleState.get(`${CHAIN_ID}`);
    expect(state?.latestRoundId).toBe(2n);
    expect(state?.latestPrice).toBe(100281001n);

    // Both individual reports are retained.
    expect((await indexer.UsycNavReport.get(`${CHAIN_ID}_17637029_0`))?.roundId).toBe(1n);
    expect((await indexer.UsycNavReport.get(`${CHAIN_ID}_17643579_0`))?.roundId).toBe(2n);
  });
});
