export type Chain = {
  id: number;
  name: string;
  short: string;
  color: string;
  /** Block-explorer base URL, no trailing slash. Empty when none is known. */
  explorer: string;
};

export const chains: Chain[] = [
  { id: 1, name: "Ethereum", short: "ETH", color: "#627EEA", explorer: "https://etherscan.io" },
  { id: 10, name: "Optimism", short: "OP", color: "#FF0420", explorer: "https://optimistic.etherscan.io" },
  { id: 50, name: "XDC", short: "XDC", color: "#2A9D8F", explorer: "https://xdcscan.com" },
  { id: 56, name: "BNB Chain", short: "BNB", color: "#F0B90B", explorer: "https://bscscan.com" },
  { id: 137, name: "Polygon", short: "POL", color: "#8247E5", explorer: "https://polygonscan.com" },
  { id: 324, name: "zkSync Era", short: "ZKS", color: "#8C8DFC", explorer: "https://explorer.zksync.io" },
  { id: 4217, name: "Tempo", short: "TMP", color: "#E76F51", explorer: "" },
  { id: 8453, name: "Base", short: "BASE", color: "#0052FF", explorer: "https://basescan.org" },
  { id: 42161, name: "Arbitrum", short: "ARB", color: "#28A0F0", explorer: "https://arbiscan.io" },
  { id: 42220, name: "Celo", short: "CELO", color: "#FCC846", explorer: "https://celoscan.io" },
  { id: 43114, name: "Avalanche", short: "AVAX", color: "#E84142", explorer: "https://snowtrace.io" },
  { id: 98866, name: "Plume", short: "PLUME", color: "#EC4899", explorer: "https://explorer.plume.org" },
];

const byId = new Map<number, Chain>(chains.map((c) => [c.id, c]));

const FALLBACK: Chain = {
  id: 0,
  name: "Unknown",
  short: "?",
  color: "#8A8F98",
  explorer: "",
};

export function chainById(id: number): Chain {
  return byId.get(id) ?? { ...FALLBACK, id, name: `Chain ${id}`, short: String(id) };
}

export function tokenExplorerUrl(chainId: number, address: string): string | null {
  const c = byId.get(chainId);
  if (!c || !c.explorer) return null;
  return `${c.explorer}/token/${address}`;
}
