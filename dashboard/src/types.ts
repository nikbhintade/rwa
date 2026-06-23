/** One deployment of a logical token on a specific chain. */
export type ChainToken = {
  chainId: number;
  address: string;
  decimals: number;
  /** Whether this deployment is actually indexed. Defaults to true; set false to
   *  gate a chip off in the UI (e.g. USDT is only indexed on Ethereum). */
  indexed?: boolean;
};

/** Asset class a token belongs to. Lives in the dashboard's token data, not in
 *  the GraphQL schema, so it is never part of a query. */
export type AssetClass = "stablecoin" | "treasury" | "credit" | "stock";

/** A logical token (e.g. USDC) that may live on many chains. */
export type Token = {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
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

/** A single daily NAV (price) point for a tokenized stock, in USD. */
export type NavPoint = {
  date: number;
  nav: number;
};

/** On-chain NAV (price) for a tokenized stock, from Chainlink push feeds. Only
 *  the subset of stocks with a published feed carries this. */
export type NavStats = {
  /** Latest NAV (USD per token); null when no feed or no data yet. */
  latest: number | null;
  /** Unix seconds of the latest NAV print. */
  latestUpdatedAt: number | null;
  /** Daily NAV series (USD), ascending by date. */
  days: NavPoint[];
};

export type TokenStats = {
  /** Supply summed across all chains. */
  totalSupply: number | null;
  /** Per-date metrics summed across all chains. */
  days: TokenDay[];
  /** Per-chain breakdown. */
  byChain: ChainSeries[];
  /** NAV/price series — tokenized stocks only. */
  nav?: NavStats;
};
