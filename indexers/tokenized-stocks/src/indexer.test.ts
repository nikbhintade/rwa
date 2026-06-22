import { describe, it, expect } from "vitest";
import { createTestIndexer, TestHelpers } from "envio";
const { Addresses } = TestHelpers;

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;
const CHAIN_ID = 1;

// Token address — must match one in config.yaml. TSLAx (Backed xStock).
const TOKEN_ADDRESS =
  "0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0" as `0x${string}`;
// TSLA / USD Chainlink aggregator (AnswerUpdated emitter) — NAV source for TSLAx.
const TSLA_AGG =
  "0x47f0840acb50df9c3b9584017ef1a9560e777b88" as `0x${string}`;

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
    contract: "BackedStocks" as const,
    event: "Transfer" as const,
    params: { from, to, value },
    block: { timestamp },
    srcAddress: TOKEN_ADDRESS,
  };
}

describe("Mint", () => {
  it("increases totalSupply, tags symbol/issuer, creates receiver HolderBalance", async () => {
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
    expect(token?.symbol).toBe("TSLAx");
    expect(token?.issuer).toBe("backed");

    const receiverBalance = await indexer.HolderBalance.get(holderBalanceId(receiver));
    expect(receiverBalance?.balance).toBe(1000n);

    // Zero address never gets a HolderBalance
    const zeroBalance = await indexer.HolderBalance.get(holderBalanceId(ZERO_ADDRESS));
    expect(zeroBalance).toBeUndefined();

    const dayData = await indexer.TokenDayData.get(dayDataId(20000));
    expect(dayData?.dailyMintAmount).toBe(1000n);
    expect(dayData?.dailyActiveAddresses).toBe(0); // zero-address mint isn't an active sender
  });
});

describe("Burn", () => {
  it("decreases totalSupply and updates sender HolderBalance", async () => {
    const indexer = createTestIndexer();
    const burner = Addresses.mockAddresses[0]! as `0x${string}`;

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
      symbol: "TSLAx",
      issuer: "backed",
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

    const dayData = await indexer.TokenDayData.get(dayDataId(20000));
    expect(dayData?.dailyBurnAmount).toBe(200n);
    expect(dayData?.dailyActiveAddresses).toBe(1);
  });
});

describe("Transfer", () => {
  it("updates both balances, records first/last timestamps, tracks active address", async () => {
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

    const dayData = await indexer.TokenDayData.get(dayDataId(20000));
    expect(dayData?.dailyTransferAmount).toBe(30n);
    expect(dayData?.dailyTransferCount).toBe(1);
    expect(dayData?.dailyActiveAddresses).toBe(1);
  });
});

describe("Day rollover", () => {
  it("deletes previous day DailyActiveAddress entries and starts fresh counters", async () => {
    const indexer = createTestIndexer();
    const sender = Addresses.mockAddresses[0]! as `0x${string}`;
    const newSender = Addresses.mockAddresses[1]! as `0x${string}`;
    const receiver = Addresses.mockAddresses[2]! as `0x${string}`;

    indexer.Token.set({
      id: tokenId(),
      chainId: CHAIN_ID,
      address: TOKEN_ADDRESS,
      symbol: "TSLAx",
      issuer: "backed",
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

    const oldEntry = await indexer.DailyActiveAddress.get(activeAddrId(20000, sender));
    expect(oldEntry).toBeUndefined();

    const newDayData = await indexer.TokenDayData.get(dayDataId(20001));
    expect(newDayData?.dailyActiveAddresses).toBe(1);
    expect(newDayData?.dailyTransferCount).toBe(1);
  });
});

describe("Ondo issuer", () => {
  it("tags OndoStocks transfers as the ondo issuer", async () => {
    const indexer = createTestIndexer();
    const receiver = Addresses.mockAddresses[0]! as `0x${string}`;
    const spyon = "0xfedc5f4a6c38211c1338aa411018dfaf26612c08" as `0x${string}`;

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "OndoStocks" as const,
              event: "Transfer" as const,
              params: { from: ZERO_ADDRESS, to: receiver, value: 1000n },
              block: { timestamp: DAY_0_TIMESTAMP },
              srcAddress: spyon,
            },
          ],
        },
      },
    });

    const token = await indexer.Token.get(`${CHAIN_ID}_${spyon}`);
    expect(token?.issuer).toBe("ondo");
    expect(token?.symbol).toBe("SPYon");
    expect(token?.totalSupply).toBe(1000n);
  });
});

describe("NAV (Chainlink AnswerUpdated)", () => {
  it("records the latest NAV for the mapped feed", async () => {
    const indexer = createTestIndexer();

    // $430.12 with 8 decimals
    const nav = 43012000000n;
    const updatedAt = BigInt(DAY_0_TIMESTAMP + 100);

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "ChainlinkNavFeed" as const,
              event: "AnswerUpdated" as const,
              params: { current: nav, roundId: 1n, updatedAt },
              block: { number: 1, timestamp: DAY_0_TIMESTAMP + 100 },
              srcAddress: TSLA_AGG,
            },
          ],
        },
      },
    });

    const state = await indexer.NavOracleState.get(`${CHAIN_ID}_${TSLA_AGG}`);
    expect(state?.token).toBe("TSLAx");
    expect(state?.latestNav).toBe(nav);
    expect(state?.decimals).toBe(8);
    expect(state?.latestUpdatedAt).toBe(updatedAt);
  });
});
