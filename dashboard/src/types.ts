export type Token = {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
};

export type TokenDay = {
  date: number;
  dailyTransferAmount: number;
  dailyTransferCount: number;
  dailyMintAmount: number;
  dailyBurnAmount: number;
};

export type TokenStats = {
  totalSupply: number | null;
  days: TokenDay[];
};
