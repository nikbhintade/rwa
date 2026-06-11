import { indexer } from "envio";
import { recordNav } from "./navShared";

// JTRSY NAV — Janus Henderson Anemoy Treasury Fund on Centrifuge. The
// PoolManager (0x91808b5e2f6d7483d41a681034d7c9dbb64b9e29) emits PriceUpdate for
// every pool/tranche; we filter to JTRSY's poolId + trancheId. `price` is the
// pool-currency-per-share NAV (18-dec) and `computedAt` is when it was struck.
// NAV is a step function (constant between updates), and the same value is often
// re-pushed across blocks, so we ignore anything not newer than the last.
const POOL_MANAGER = "0x91808b5e2f6d7483d41a681034d7c9dbb64b9e29";
const POOL_ID = 4139849551n; // 0xf6bd674f
const TRANCHE_ID = "0x97aa65f23e7be09fcd62d0554d2e9273";
const NAV_DECIMALS = 18;

indexer.onEvent(
  { contract: "JtrsyPoolManager", event: "PriceUpdate" },
  async ({ event, context }) => {
    if (event.params.poolId !== POOL_ID) return;
    if (event.params.trancheId.toLowerCase() !== TRANCHE_ID) return;

    const computedAt = event.params.computedAt;
    const state = await context.NavOracleState.get(`${event.chainId}_${POOL_MANAGER}`);
    if (state && computedAt <= state.latestUpdatedAt) return; // stale / re-push

    await recordNav({
      context,
      chainId: event.chainId,
      oracle: POOL_MANAGER,
      token: "JTRSY",
      decimals: NAV_DECIMALS,
      nav: event.params.price,
      updatedAt: computedAt,
      mode: "step",
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      logIndex: event.logIndex,
    });
  },
);
