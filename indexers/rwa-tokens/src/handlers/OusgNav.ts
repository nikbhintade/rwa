import { indexer } from "envio";
import { recordNav } from "./navShared";

// OUSG NAV — Ondo's RWAOracleExternalComparisonCheck
// (0x0502c5ae08e7cd64fe1aeda7d6e229413ecc6abe). Ondo pushes the end-of-day NAV
// via RWAExternalComparisonCheckPriceSet; `newRWAPrice` is the OUSG price
// (18-dec). NAV is a step function (constant between EOD updates).
const ORACLE = "0x0502c5ae08e7cd64fe1aeda7d6e229413ecc6abe";
const NAV_DECIMALS = 18;

indexer.onEvent(
  { contract: "OusgOracle", event: "RWAExternalComparisonCheckPriceSet" },
  async ({ event, context }) => {
    await recordNav({
      context,
      chainId: event.chainId,
      oracle: ORACLE,
      token: "OUSG",
      decimals: NAV_DECIMALS,
      nav: event.params.newRWAPrice,
      updatedAt: BigInt(event.block.timestamp),
      mode: "step",
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      logIndex: event.logIndex,
    });
  },
);
