import { indexer } from "envio";
import { recordNav } from "./navShared";

// USTB NAV — Superstate oracle (0xe4fA682f94610cCd170680cc3B045d77D9E528a8).
// It emits NewCheckpoint anchors; realtime NAV grows linearly between consecutive
// checkpoints. `navs` is 6-dec; `effectiveAt` is when the checkpoint takes effect,
// which is the boundary the oracle interpolates over.
const ORACLE = "0xe4fa682f94610ccd170680cc3b045d77d9e528a8";
const NAV_DECIMALS = 6;

indexer.onEvent(
  { contract: "UstbNavOracle", event: "NewCheckpoint" },
  async ({ event, context }) => {
    await recordNav({
      context,
      chainId: event.chainId,
      oracle: ORACLE,
      token: "USTB",
      decimals: NAV_DECIMALS,
      nav: event.params.navs,
      updatedAt: event.params.effectiveAt,
      mode: "linear",
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      logIndex: event.logIndex,
    });
  },
);
