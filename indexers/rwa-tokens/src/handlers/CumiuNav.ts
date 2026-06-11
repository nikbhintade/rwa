import { indexer } from "envio";
import { recordNav } from "./navShared";

// CUMIU NAV — published by the token contract itself via `updatedNAV`. It is the
// only emitter of that event in the Treasuries group, so filter by srcAddress.
// newNAV is 1e4 fixed-point (NAVScalingFactor = 10000), e.g. 1033353 => $103.3353.
const CUMIU = "0x85d38585c3ac08268f598282a84b7c0ddfc0d04f";
const NAV_DECIMALS = 4;

indexer.onEvent(
  { contract: "Treasuries", event: "updatedNAV" },
  async ({ event, context }) => {
    if (event.srcAddress.toLowerCase() !== CUMIU) return;
    await recordNav({
      context,
      chainId: event.chainId,
      oracle: CUMIU,
      token: "CUMIU",
      decimals: NAV_DECIMALS,
      nav: event.params.newNAV,
      updatedAt: BigInt(event.block.timestamp),
      mode: "step",
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      logIndex: event.logIndex,
    });
  },
);
