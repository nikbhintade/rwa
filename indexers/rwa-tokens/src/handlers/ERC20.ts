import { indexer, type EvmOnEventContext } from "envio";
import { isRebase, recordYieldMint, writeDollarSnapshot } from "./rebaseYield";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type AssetClass = "stablecoin" | "treasury";

async function handleTransfer(
  event: {
    chainId: number;
    srcAddress: string;
    block: { timestamp: number };
    params: { from: string; to: string; value: bigint };
  },
  context: EvmOnEventContext,
  assetClass: AssetClass,
) {
  const { from, to, value } = event.params;
  const chainId = event.chainId;
  const tokenAddress = event.srcAddress;
  const timestamp = event.block.timestamp;
  const currentDayId = Math.floor(timestamp / 86400);
  const midnightTimestamp = currentDayId * 86400;

  const isMint = from === ZERO_ADDRESS;
  const isBurn = to === ZERO_ADDRESS;

  const tokenId = `${chainId}_${tokenAddress}`;
  const dayDataId = `${tokenId}_${currentDayId}`;
  const fromBalanceId = `${tokenId}_${from}`;
  const toBalanceId = `${tokenId}_${to}`;
  const activeAddrId = `${tokenId}_${currentDayId}_${from}`;

  const [existingToken, existingDayData, fromBalance, toBalance, existingActiveAddr] =
    await Promise.all([
      context.Token.get(tokenId),
      context.TokenDayData.get(dayDataId),
      !isMint ? context.HolderBalance.get(fromBalanceId) : Promise.resolve(undefined),
      !isBurn ? context.HolderBalance.get(toBalanceId) : Promise.resolve(undefined),
      !isMint ? context.DailyActiveAddress.get(activeAddrId) : Promise.resolve(undefined),
    ]);

  const lastDayId = existingToken?.lastDayId ?? currentDayId;
  const isNewDay = currentDayId > lastDayId;

  if (isNewDay) {
    const stale = await context.DailyActiveAddress.getWhere({
      token_id: { _eq: tokenId },
    });
    for (const entry of stale) {
      context.DailyActiveAddress.deleteUnsafe(entry.id);
    }
  }

  const isNewActiveAddr = !isMint && (isNewDay || !existingActiveAddr);

  let newTotalSupply = existingToken?.totalSupply ?? 0n;
  if (isMint) newTotalSupply += value;
  if (isBurn) newTotalSupply -= value;

  context.Token.set({
    id: tokenId,
    chainId,
    address: tokenAddress,
    assetClass,
    totalSupply: newTotalSupply,
    lastDayId: currentDayId,
  });

  context.TokenDayData.set({
    id: dayDataId,
    token_id: tokenId,
    chainId,
    date: midnightTimestamp,
    dailyTotalSupply: newTotalSupply,
    dailyMintAmount: (existingDayData?.dailyMintAmount ?? 0n) + (isMint ? value : 0n),
    dailyBurnAmount: (existingDayData?.dailyBurnAmount ?? 0n) + (isBurn ? value : 0n),
    dailyTransferAmount: (existingDayData?.dailyTransferAmount ?? 0n) + value,
    dailyTransferCount: (existingDayData?.dailyTransferCount ?? 0) + 1,
    dailyActiveAddresses: (existingDayData?.dailyActiveAddresses ?? 0) + (isNewActiveAddr ? 1 : 0),
  });

  if (!isMint) {
    context.HolderBalance.set({
      id: fromBalanceId,
      token_id: tokenId,
      chainId,
      holder: from,
      balance: (fromBalance?.balance ?? 0n) - value,
      firstTransferTimestamp: fromBalance?.firstTransferTimestamp ?? BigInt(timestamp),
      lastTransferTimestamp: BigInt(timestamp),
    });
  }

  if (!isBurn) {
    context.HolderBalance.set({
      id: toBalanceId,
      token_id: tokenId,
      chainId,
      holder: to,
      balance: (toBalance?.balance ?? 0n) + value,
      firstTransferTimestamp: toBalance?.firstTransferTimestamp ?? BigInt(timestamp),
      lastTransferTimestamp: BigInt(timestamp),
    });
  }

  if (isNewActiveAddr) {
    context.DailyActiveAddress.set({
      id: activeAddrId,
      token_id: tokenId,
      chainId,
      date: currentDayId,
      address: from,
    });
  }

  // Rebase-yield funds (BENJI/iBENJI, BUIDL, WTGXX, FDIT) pin NAV at $1.00 and
  // pay yield as new shares minted to holders. Record the $1.00 NAV snapshot on
  // every transfer, and derive the per-share yield rate on dividend mints:
  // toBalance is the recipient's balance before this mint, exactly the
  // priorBalance needed.
  if (assetClass === "treasury" && isRebase(tokenAddress)) {
    writeDollarSnapshot(context, chainId, tokenAddress, timestamp);
    if (isMint) {
      await recordYieldMint({
        context,
        chainId,
        tokenAddress,
        amount: value,
        priorBalance: toBalance?.balance ?? 0n,
        sharesOutstanding: newTotalSupply,
        timestamp,
      });
    }
  }
}

// USDT issue/redeem do not emit Transfer; totalSupply must be adjusted from these custom events.
async function handleSupplyChange(
  event: {
    chainId: number;
    srcAddress: string;
    block: { timestamp: number };
    params: { amount: bigint };
  },
  context: EvmOnEventContext,
  direction: "mint" | "burn",
  assetClass: AssetClass,
) {
  const { amount } = event.params;
  const chainId = event.chainId;
  const tokenAddress = event.srcAddress;
  const timestamp = event.block.timestamp;
  const currentDayId = Math.floor(timestamp / 86400);
  const midnightTimestamp = currentDayId * 86400;

  const tokenId = `${chainId}_${tokenAddress}`;
  const dayDataId = `${tokenId}_${currentDayId}`;

  const [existingToken, existingDayData] = await Promise.all([
    context.Token.get(tokenId),
    context.TokenDayData.get(dayDataId),
  ]);

  const lastDayId = existingToken?.lastDayId ?? currentDayId;
  const isNewDay = currentDayId > lastDayId;

  if (isNewDay) {
    const stale = await context.DailyActiveAddress.getWhere({
      token_id: { _eq: tokenId },
    });
    for (const entry of stale) {
      context.DailyActiveAddress.deleteUnsafe(entry.id);
    }
  }

  let newTotalSupply = existingToken?.totalSupply ?? 0n;
  if (direction === "mint") newTotalSupply += amount;
  else newTotalSupply -= amount;

  context.Token.set({
    id: tokenId,
    chainId,
    address: tokenAddress,
    assetClass,
    totalSupply: newTotalSupply,
    lastDayId: currentDayId,
  });

  context.TokenDayData.set({
    id: dayDataId,
    token_id: tokenId,
    chainId,
    date: midnightTimestamp,
    dailyTotalSupply: newTotalSupply,
    dailyMintAmount:
      (existingDayData?.dailyMintAmount ?? 0n) + (direction === "mint" ? amount : 0n),
    dailyBurnAmount:
      (existingDayData?.dailyBurnAmount ?? 0n) + (direction === "burn" ? amount : 0n),
    dailyTransferAmount: existingDayData?.dailyTransferAmount ?? 0n,
    dailyTransferCount: existingDayData?.dailyTransferCount ?? 0,
    dailyActiveAddresses: existingDayData?.dailyActiveAddresses ?? 0,
  });
}

indexer.onEvent(
  { contract: "Stablecoins", event: "Transfer" },
  async ({ event, context }) => {
    await handleTransfer(event, context, "stablecoin");
  },
);

// Ethereum mainnet USDT. issue/redeem do NOT emit Transfer, so supply is
// adjusted from the custom Issue/Redeem events; normal transfers come through
// the Transfer handler.
indexer.onEvent(
  { contract: "USDT", event: "Transfer" },
  async ({ event, context }) => {
    await handleTransfer(event, context, "stablecoin");
  },
);

indexer.onEvent(
  { contract: "USDT", event: "Issue" },
  async ({ event, context }) => {
    await handleSupplyChange(event, context, "mint", "stablecoin");
  },
);

indexer.onEvent(
  { contract: "USDT", event: "Redeem" },
  async ({ event, context }) => {
    await handleSupplyChange(event, context, "burn", "stablecoin");
  },
);

// Bridged USDT (all non-Ethereum chains). mint/burn/redeem internally emit
// Transfer to/from the zero address, so the Transfer handler tracks supply for
// the whole lifecycle — no separate supply-change handler needed.
indexer.onEvent(
  { contract: "USDTBridged", event: "Transfer" },
  async ({ event, context }) => {
    await handleTransfer(event, context, "stablecoin");
  },
);

// US Treasuries asset class. Standard ERC-20s — supply/holders from Transfer,
// same as the Stablecoins group.
indexer.onEvent(
  { contract: "Treasuries", event: "Transfer" },
  async ({ event, context }) => {
    await handleTransfer(event, context, "treasury");
  },
);
