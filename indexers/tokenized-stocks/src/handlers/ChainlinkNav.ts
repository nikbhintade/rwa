import { indexer } from "envio";
import { recordNav } from "./navShared";

// On-chain NAV from Chainlink push aggregators. Each aggregator emits
// `AnswerUpdated(current, roundId, updatedAt)`; `current` is the NAV in 8-decimal
// USD and is constant between updates (step function).
//
//   - Backed xStocks: the underlying equity feed IS the NAV (token is 1:1 backed,
//     no multiplier) — e.g. "TSLA / USD" -> TSLAx.
//   - Ondo *on: the per-token "XXXon-USD (Calculated)" feed IS the NAV — Chainlink
//     already folds the SyntheticSharesOracle sValue multiplier into it.
//
// Map is keyed by the *aggregator* address (the AnswerUpdated emitter, resolved via
// `aggregator()` on the feed proxy), lowercased. Note: Chainlink occasionally rotates
// the aggregator behind a proxy; if a feed goes quiet, re-resolve `aggregator()` and
// add the new address here and in config.yaml.
const FEEDS: Record<string, { token: string; decimals: number }> = {
  // Ondo "(Calculated)" feeds = NAV per token (sValue multiplier included)
  "0x2053257478ba1fedf7f99def0c412006753ac9bf": { token: "SPYon", decimals: 8 },
  "0x320e22c489e4bb634ac1aa5822543014a6fbb292": { token: "QQQon", decimals: 8 },
  // Backed xStocks: underlying equity feed = NAV (1:1)
  "0x47f0840acb50df9c3b9584017ef1a9560e777b88": { token: "TSLAx", decimals: 8 }, // TSLA / USD
  "0x725609ae7d540a7985d7fd189e155db9d72c1d44": { token: "STRCx", decimals: 8 }, // STRC / USD
  // Interim: NVDAon priced off the underlying NVDA feed (no Calculated feed published
  // yet). sValue multiplier omitted (~1.0 for non-dividend NVDA); swap to the
  // Calculated aggregator when it exists, and drop this line to avoid two oracles
  // tagging "NVDAon".
  "0x74acdd8ca84ff6a9eb0814e7f000b4f33195152d": { token: "NVDAon", decimals: 8 }, // NVDA-USD (24/5)
  // No on-chain push feed exists for CRCLon, MUon, IVVon, HIMSon, or the CRCL
  // underlying (CRCLx) — Chainlink serves those via pull-based Data Streams (no
  // on-chain AnswerUpdated). Add them here when a "(Calculated)" feed is published.
};

indexer.onEvent(
  { contract: "ChainlinkNavFeed", event: "AnswerUpdated" },
  async ({ event, context }) => {
    const feed = FEEDS[event.srcAddress];
    if (!feed) return; // unmapped aggregator — ignore

    await recordNav({
      context,
      chainId: event.chainId,
      oracle: event.srcAddress,
      token: feed.token,
      decimals: feed.decimals,
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
