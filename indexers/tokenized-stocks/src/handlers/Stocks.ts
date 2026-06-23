import { indexer, type EvmOnEventContext } from "envio";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type Issuer = "backed" | "ondo";

// Token symbol per contract address (keys lowercased). Backed xStocks share one
// address across all chains; Ondo tokens have a distinct address per chain — every
// address is globally unique, so a flat address->symbol map is unambiguous. Look up
// with a lowercased address: Envio delivers `srcAddress` EIP-55 checksummed, so an
// un-normalised lookup misses and falls back to the raw address.
const SYMBOLS: Record<string, string> = {
  // --- Backed xStocks (same address on every chain) ---
  "0x1aad217b8f78dba5e6693460e8470f8b1a3977f3": "STRCx",
  "0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0": "TSLAx",
  "0xfebded1b0986a8ee107f5ab1a1c5a813491deceb": "CRCLx",
  // --- Ondo Global Markets (one address per chain) ---
  // CRCLon
  "0x3632dea96a953c11dac2f00b4a05a32cd1063fae": "CRCLon", // Ethereum
  "0x992879cd8ce0c312d98648875b5a8d6d042cbf34": "CRCLon", // BSC
  "0x13a81c5e8b4ab05fc721dff7ba95e250b29458f8": "CRCLon", // HyperEVM
  // MUon
  "0x050362ab1072cb2ce74d74770e22a3203ad04ee5": "MUon", // Ethereum
  "0x8b6acf6041a81567f012ff6a4c6d96d5818d74bf": "MUon", // BSC
  "0x0f8e33f5cdefae9c2e59de8fb61fed347046d046": "MUon", // HyperEVM
  // IVVon
  "0x62ca254a363dc3c748e7e955c20447ab5bf06ff7": "IVVon", // Ethereum
  "0x1104eb7e85e25eb45f88e638b0c27a06c1a91cb2": "IVVon", // BSC
  "0xad26b6048cc3682f67fe4c829b7ac99dbf95920e": "IVVon", // HyperEVM
  // NVDAon
  "0x2d1f7226bd1f780af6b9a49dcc0ae00e8df4bdee": "NVDAon", // Ethereum
  "0xa9ee28c80f960b889dfbd1902055218cba016f75": "NVDAon", // BSC
  "0xb989ad9b91886b1aaed8daadb26f028b29b40945": "NVDAon", // HyperEVM
  // SPYon
  "0xfedc5f4a6c38211c1338aa411018dfaf26612c08": "SPYon", // Ethereum
  "0x6a708ead771238919d85930b5a0f10454e1c331a": "SPYon", // BSC
  "0x32ec2792aec02122edd9f28866b720db1e1c1b54": "SPYon", // HyperEVM
  // QQQon
  "0x0e397938c1aa0680954093495b70a9f5e2249aba": "QQQon", // Ethereum
  "0x0cde6936d305d5b34667fc46425e852efd73559a": "QQQon", // BSC
  "0x911e2dcd2b70f44231f3f0f1c6ec9af75068fd85": "QQQon", // HyperEVM
  // HIMSon
  "0xca468554e5c0423ee858fe3942c9568c51fcaa79": "HIMSon", // Ethereum
  "0x4693f6f5ef257381a28afd0673e64d8b32d5c6ad": "HIMSon", // BSC
};

async function handleTransfer(
  event: {
    chainId: number;
    srcAddress: string;
    block: { timestamp: number };
    params: { from: string; to: string; value: bigint };
  },
  context: EvmOnEventContext,
  issuer: Issuer,
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
    symbol: SYMBOLS[tokenAddress.toLowerCase()] ?? tokenAddress,
    issuer,
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
}

// Backed xStocks (STRCx, TSLAx, CRCLx). Standard ERC-20 — supply/holders from Transfer.
indexer.onEvent(
  { contract: "BackedStocks", event: "Transfer" },
  async ({ event, context }) => {
    await handleTransfer(event, context, "backed");
  },
);

// Ondo Global Markets (*on). Standard ERC-20 — supply/holders from Transfer.
indexer.onEvent(
  { contract: "OndoStocks", event: "Transfer" },
  async ({ event, context }) => {
    await handleTransfer(event, context, "ondo");
  },
);
