import { indexer } from "envio";

// USYC NAV — Hashnote/Circle YieldTokenAggregator oracle
// (proxy 0x4c48bcb2160F8e0aDbf9D4F3B034f1e36d1f8b3e, Ethereum).
//
// Unlike USDY (a deterministic compounding curve we compute), USYC prints NAV
// directly: BalanceReported carries `price` (NAV per token, 8-dec) once per
// business day. So each event is a NAV datapoint — just store it. balance and
// interest are 2-dec USD (fund AUM / accrued interest).

const ORACLE = "0x4c48bcb2160f8e0adbf9d4f3b034f1e36d1f8b3e";
const DAY = 86400;

indexer.onEvent(
  { contract: "USYCOracle", event: "BalanceReported" },
  async ({ event, context }) => {
    const { roundId, balance, interest, price, updatedAt } = event.params;
    const chainId = event.chainId;

    context.UsycNavReport.set({
      id: `${chainId}_${event.block.number}_${event.logIndex}`,
      chainId,
      oracle: ORACLE,
      roundId,
      price,
      balance,
      interest,
      updatedAt,
      date: Math.floor(Number(updatedAt) / DAY) * DAY,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
    });

    // Keep the per-chain singleton on the newest round only (guards reorgs /
    // any out-of-order delivery).
    const state = await context.UsycOracleState.get(`${chainId}`);
    if (!state || roundId >= state.latestRoundId) {
      context.UsycOracleState.set({
        id: `${chainId}`,
        chainId,
        latestRoundId: roundId,
        latestPrice: price,
        latestUpdatedAt: updatedAt,
      });
    }
  },
);

indexer.onEvent(
  { contract: "USYCOracle", event: "NextPriceReported" },
  async ({ event, context }) => {
    context.UsycNextPrice.set({
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      chainId: event.chainId,
      price: event.params.price,
      blockTimestamp: event.block.timestamp,
    });
  },
);
