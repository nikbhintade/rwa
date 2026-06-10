import { describe, it, expect, beforeEach } from "vitest";
import { createTestIndexer, TestHelpers } from "envio";
const { Addresses } = TestHelpers;

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;
const CHAIN_ID = 1;

// Token address — must match one in config.yaml. USDT on Ethereum mainnet.
const TOKEN_ADDRESS =
  "0xdAC17F958D2ee523a2206206994597C13D831ec7" as `0x${string}`; // USDT checksummed

const DAY_0_TIMESTAMP = 86400 * 20000; // day 20000
const DAY_1_TIMESTAMP = 86400 * 20001; // day 20001

function tokenId() {
  return `${CHAIN_ID}_${TOKEN_ADDRESS}`;
}
function dayDataId(dayId: number) {
  return `${tokenId()}_${dayId}`;
}
function holderBalanceId(address: string) {
  return `${tokenId()}_${address}`;
}
function activeAddrId(dayId: number, address: string) {
  return `${tokenId()}_${dayId}_${address}`;
}

function makeTransfer(
  from: `0x${string}`,
  to: `0x${string}`,
  value: bigint,
  timestamp = DAY_0_TIMESTAMP
) {
  return {
    contract: "USDT" as const,
    event: "Transfer" as const,
    params: { from, to, value },
    block: { timestamp },
    srcAddress: TOKEN_ADDRESS,
  };
}

describe("Mint", () => {
  it("increases totalSupply and creates receiver HolderBalance", async () => {
    const indexer = createTestIndexer();
    const receiver = Addresses.mockAddresses[0]! as `0x${string}`;

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [makeTransfer(ZERO_ADDRESS, receiver, 1000n)],
        },
      },
    });

    const token = await indexer.Token.get(tokenId());
    expect(token?.totalSupply).toBe(1000n);
    expect(token?.assetClass).toBe("stablecoin");

    const receiverBalance = await indexer.HolderBalance.get(holderBalanceId(receiver));
    expect(receiverBalance?.balance).toBe(1000n);

    // Zero address should not get a HolderBalance
    const zeroBalance = await indexer.HolderBalance.get(holderBalanceId(ZERO_ADDRESS));
    expect(zeroBalance).toBeUndefined();

    // Zero address is not a real sender — no DailyActiveAddress
    const activeAddr = await indexer.DailyActiveAddress.get(
      activeAddrId(20000, ZERO_ADDRESS)
    );
    expect(activeAddr).toBeUndefined();

    const dayData = await indexer.TokenDayData.get(dayDataId(20000));
    expect(dayData?.dailyMintAmount).toBe(1000n);
    expect(dayData?.dailyBurnAmount).toBe(0n);
    expect(dayData?.dailyActiveAddresses).toBe(0);
  });
});

describe("Burn", () => {
  it("decreases totalSupply and updates sender HolderBalance", async () => {
    const indexer = createTestIndexer();
    const burner = Addresses.mockAddresses[0]! as `0x${string}`;

    // Seed initial balance
    indexer.HolderBalance.set({
      id: holderBalanceId(burner),
      token_id: tokenId(),
      chainId: CHAIN_ID,
      holder: burner,
      balance: 500n,
      firstTransferTimestamp: BigInt(DAY_0_TIMESTAMP),
      lastTransferTimestamp: BigInt(DAY_0_TIMESTAMP),
    });
    indexer.Token.set({
      id: tokenId(),
      chainId: CHAIN_ID,
      address: TOKEN_ADDRESS,
      assetClass: "stablecoin",
      totalSupply: 500n,
      lastDayId: 20000,
    });

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [makeTransfer(burner, ZERO_ADDRESS, 200n)],
        },
      },
    });

    const token = await indexer.Token.get(tokenId());
    expect(token?.totalSupply).toBe(300n);

    const burnerBalance = await indexer.HolderBalance.get(holderBalanceId(burner));
    expect(burnerBalance?.balance).toBe(300n);

    // Zero address should not get a HolderBalance on burn
    const zeroBalance = await indexer.HolderBalance.get(holderBalanceId(ZERO_ADDRESS));
    expect(zeroBalance).toBeUndefined();

    const dayData = await indexer.TokenDayData.get(dayDataId(20000));
    expect(dayData?.dailyBurnAmount).toBe(200n);
    expect(dayData?.dailyActiveAddresses).toBe(1);
  });
});

describe("Transfer", () => {
  it("updates both balances, records first/last timestamps, and tracks active address", async () => {
    const indexer = createTestIndexer();
    const sender = Addresses.mockAddresses[0]! as `0x${string}`;
    const receiver = Addresses.mockAddresses[1]! as `0x${string}`;

    indexer.HolderBalance.set({
      id: holderBalanceId(sender),
      token_id: tokenId(),
      chainId: CHAIN_ID,
      holder: sender,
      balance: 100n,
      firstTransferTimestamp: 1000n,
      lastTransferTimestamp: 1000n,
    });

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [makeTransfer(sender, receiver, 30n, DAY_0_TIMESTAMP)],
        },
      },
    });

    const senderBalance = await indexer.HolderBalance.get(holderBalanceId(sender));
    expect(senderBalance?.balance).toBe(70n);
    expect(senderBalance?.firstTransferTimestamp).toBe(1000n); // preserved
    expect(senderBalance?.lastTransferTimestamp).toBe(BigInt(DAY_0_TIMESTAMP));

    const receiverBalance = await indexer.HolderBalance.get(holderBalanceId(receiver));
    expect(receiverBalance?.balance).toBe(30n);
    expect(receiverBalance?.firstTransferTimestamp).toBe(BigInt(DAY_0_TIMESTAMP));

    const activeAddr = await indexer.DailyActiveAddress.get(activeAddrId(20000, sender));
    expect(activeAddr).toBeDefined();

    const dayData = await indexer.TokenDayData.get(dayDataId(20000));
    expect(dayData?.dailyTransferAmount).toBe(30n);
    expect(dayData?.dailyTransferCount).toBe(1);
    expect(dayData?.dailyActiveAddresses).toBe(1);
  });

  it("does not double-count repeated sender in same day", async () => {
    const indexer = createTestIndexer();
    const sender = Addresses.mockAddresses[0]! as `0x${string}`;
    const receiver = Addresses.mockAddresses[1]! as `0x${string}`;

    indexer.HolderBalance.set({
      id: holderBalanceId(sender),
      token_id: tokenId(),
      chainId: CHAIN_ID,
      holder: sender,
      balance: 200n,
      firstTransferTimestamp: 1000n,
      lastTransferTimestamp: 1000n,
    });

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            makeTransfer(sender, receiver, 10n, DAY_0_TIMESTAMP),
            makeTransfer(sender, receiver, 10n, DAY_0_TIMESTAMP),
          ],
        },
      },
    });

    const dayData = await indexer.TokenDayData.get(dayDataId(20000));
    expect(dayData?.dailyTransferCount).toBe(2);
    expect(dayData?.dailyActiveAddresses).toBe(1); // same sender, same day
  });
});

describe("Day rollover", () => {
  it("deletes previous day DailyActiveAddress entries and starts fresh counters", async () => {
    const indexer = createTestIndexer();
    const sender = Addresses.mockAddresses[0]! as `0x${string}`;
    const newSender = Addresses.mockAddresses[1]! as `0x${string}`;
    const receiver = Addresses.mockAddresses[2]! as `0x${string}`;

    // Seed state at end of day 20000
    indexer.Token.set({
      id: tokenId(),
      chainId: CHAIN_ID,
      address: TOKEN_ADDRESS,
      assetClass: "stablecoin",
      totalSupply: 1000n,
      lastDayId: 20000,
    });
    indexer.DailyActiveAddress.set({
      id: activeAddrId(20000, sender),
      token_id: tokenId(),
      chainId: CHAIN_ID,
      date: 20000,
      address: sender,
    });
    indexer.HolderBalance.set({
      id: holderBalanceId(newSender),
      token_id: tokenId(),
      chainId: CHAIN_ID,
      holder: newSender,
      balance: 500n,
      firstTransferTimestamp: BigInt(DAY_0_TIMESTAMP),
      lastTransferTimestamp: BigInt(DAY_0_TIMESTAMP),
    });

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [makeTransfer(newSender, receiver, 50n, DAY_1_TIMESTAMP)],
        },
      },
    });

    // Old DailyActiveAddress should be deleted
    const oldEntry = await indexer.DailyActiveAddress.get(activeAddrId(20000, sender));
    expect(oldEntry).toBeUndefined();

    // New day has only the new sender
    const newDayData = await indexer.TokenDayData.get(dayDataId(20001));
    expect(newDayData?.dailyActiveAddresses).toBe(1);
    expect(newDayData?.dailyTransferCount).toBe(1);

    const newEntry = await indexer.DailyActiveAddress.get(activeAddrId(20001, newSender));
    expect(newEntry).toBeDefined();
  });
});

describe("Asset class", () => {
  it("tags Treasuries transfers as the treasury asset class", async () => {
    const indexer = createTestIndexer();
    const receiver = Addresses.mockAddresses[0]! as `0x${string}`;

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "Treasuries" as const,
              event: "Transfer" as const,
              params: { from: ZERO_ADDRESS, to: receiver, value: 1000n },
              block: { timestamp: DAY_0_TIMESTAMP },
              srcAddress: TOKEN_ADDRESS,
            },
          ],
        },
      },
    });

    const token = await indexer.Token.get(tokenId());
    expect(token?.assetClass).toBe("treasury");
    expect(token?.totalSupply).toBe(1000n);
  });
});
