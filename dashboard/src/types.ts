/** One deployment of a logical token on a specific chain. */
export type ChainToken = {
  chainId: number;
  address: string;
  decimals: number;
};

/** A logical token (e.g. USDC) that may live on many chains. */
export type Token = {
  id: string;
  symbol: string;
  name: string;
  chains: ChainToken[];
};

export type TokenDay = {
  date: number;
  dailyTransferAmount: number;
  dailyTransferCount: number;
  dailyMintAmount: number;
  dailyBurnAmount: number;
};

/** Time series for a single chain within a logical token. */
export type ChainSeries = {
  chainId: number;
  totalSupply: number | null;
  days: TokenDay[];
};

export type TokenStats = {
  /** Supply summed across all chains. */
  totalSupply: number | null;
  /** Per-date metrics summed across all chains. */
  days: TokenDay[];
  /** Per-chain breakdown. */
  byChain: ChainSeries[];
};
