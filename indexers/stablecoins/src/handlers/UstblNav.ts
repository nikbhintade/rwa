import { indexer } from "envio";
import { recordNav } from "./navShared";

// USTBL NAV — Spiko's Chainlink feed "USTBL NAV". AnswerUpdated is emitted by the
// underlying aggregator (0xc1c24f0f2103f5899b7ab415a1930e519b7d3423); `current`
// is the NAV (6-dec) and `updatedAt` the feed timestamp. NAV is a step function
// (constant between updates).
const FEED = "0xc1c24f0f2103f5899b7ab415a1930e519b7d3423";
const NAV_DECIMALS = 6;

indexer.onEvent(
  { contract: "UstblNavFeed", event: "AnswerUpdated" },
  async ({ event, context }) => {
    await recordNav({
      context,
      chainId: event.chainId,
      oracle: FEED,
      token: "USTBL",
      decimals: NAV_DECIMALS,
      nav: event.params.current,
      updatedAt: event.params.updatedAt,
      mode: "step",
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      logIndex: event.logIndex,
      roundId: event.params.roundId,
    });
  },
);
