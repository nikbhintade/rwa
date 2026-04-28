import { ERC20 } from "generated";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

ERC20.Transfer.handler(async ({ event, context }) => {
  const { from, to, value } = event.params;
  const chainId = event.chainId;
  const tokenAddress = event.srcAddress;
  const timestamp = event.block.timestamp;
  const currentDayId = Math.floor(timestamp / 86400);

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

  // On day rollover: delete previous day's active address entries for this token
  if (isNewDay) {
    const stale = await context.DailyActiveAddress.getWhere({
      token_id: { _eq: tokenId },
    });
    for (const entry of stale) {
      context.DailyActiveAddress.deleteUnsafe(entry.id);
    }
  }

  const isNewActiveAddr = !isMint && (isNewDay || !existingActiveAddr);

  // Token — update totalSupply
  let newTotalSupply = existingToken?.totalSupply ?? 0n;
  if (isMint) newTotalSupply += value;
  if (isBurn) newTotalSupply -= value;

  context.Token.set({
    id: tokenId,
    chainId,
    address: tokenAddress,
    totalSupply: newTotalSupply,
    lastDayId: currentDayId,
  });

  // TokenDayData — daily aggregates
  context.TokenDayData.set({
    id: dayDataId,
    token_id: tokenId,
    chainId,
    date: currentDayId,
    dailyMintAmount: (existingDayData?.dailyMintAmount ?? 0n) + (isMint ? value : 0n),
    dailyBurnAmount: (existingDayData?.dailyBurnAmount ?? 0n) + (isBurn ? value : 0n),
    dailyTransferAmount: (existingDayData?.dailyTransferAmount ?? 0n) + value,
    dailyTransferCount: (existingDayData?.dailyTransferCount ?? 0) + 1,
    dailyActiveAddresses: (existingDayData?.dailyActiveAddresses ?? 0) + (isNewActiveAddr ? 1 : 0),
  });

  // HolderBalance — sender (skip zero address on mints)
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

  // HolderBalance — receiver (skip zero address on burns)
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

  // DailyActiveAddress — one entity per unique sender per day per token
  if (isNewActiveAddr) {
    context.DailyActiveAddress.set({
      id: activeAddrId,
      token_id: tokenId,
      chainId,
      date: currentDayId,
      address: from,
    });
  }
});
