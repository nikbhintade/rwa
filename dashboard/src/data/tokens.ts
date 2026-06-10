import type { Token } from "../types";

// Logical tokens with their per-chain deployments. Decimals are per deployment:
// most bridged USDC is 6, but e.g. Binance-Peg USDC on BNB Chain is 18.
// Symbols/decimals verified on-chain — note the indexer config's address
// comments are not always correct (Arbitrum 0x4685… is PYUSD, not DAI).
export const tokens: Token[] = [
  {
    id: "usdt",
    symbol: "USDT",
    name: "Tether USD",
    // Binance-Peg USDT on BNB Chain is 18 decimals; every other deployment is 6.
    chains: [
      { chainId: 1, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
      { chainId: 10, address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
      { chainId: 56, address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
      { chainId: 137, address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
      { chainId: 4217, address: "0x20C00000000000000000000014f22CA97301EB73", decimals: 6 },
      { chainId: 42161, address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
      { chainId: 42220, address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 },
      { chainId: 43114, address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
      { chainId: 98866, address: "0xda6087E69C51E7D31b6DBAD276a3c44703DFdCAd", decimals: 6 },
    ],
  },
  {
    id: "usdc",
    symbol: "USDC",
    name: "USD Coin",
    // Native USDC plus bridged USDC.e — both counted as USDC. Where a chain has
    // both, their per-day metrics and supply are summed for that chain.
    chains: [
      { chainId: 1, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
      { chainId: 10, address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
      { chainId: 10, address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", decimals: 6 },
      { chainId: 50, address: "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1", decimals: 6 },
      { chainId: 56, address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
      { chainId: 137, address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
      { chainId: 137, address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
      { chainId: 324, address: "0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4", decimals: 6 },
      { chainId: 4217, address: "0x20C000000000000000000000b9537d11c60E8b50", decimals: 6 },
      { chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
      { chainId: 42161, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
      { chainId: 42161, address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", decimals: 6 },
      { chainId: 42220, address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6 },
      { chainId: 43114, address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
      { chainId: 98866, address: "0x222365EF19F7947e5484218551B56bb3965Aa7aF", decimals: 6 },
      { chainId: 98866, address: "0x78adD880A697070c1e765Ac44D65323a0DcCE913", decimals: 6 },
    ],
  },
  {
    id: "usds",
    symbol: "USDS",
    name: "Sky USDS",
    chains: [
      { chainId: 1, address: "0xdC035D45d973E3EC169d2276DDab16f1e407384F", decimals: 18 },
    ],
  },
  {
    id: "usde",
    symbol: "USDe",
    name: "Ethena USD",
    chains: [
      { chainId: 1, address: "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3", decimals: 18 },
      { chainId: 43114, address: "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34", decimals: 18 },
    ],
  },
  {
    id: "dai",
    symbol: "DAI",
    name: "Dai Stablecoin",
    chains: [
      { chainId: 1, address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
      { chainId: 137, address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
    ],
  },
  {
    id: "pyusd",
    symbol: "PYUSD",
    name: "PayPal USD",
    chains: [
      { chainId: 1, address: "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8", decimals: 6 },
      { chainId: 42161, address: "0x46850aD61C2B7d64d08c9C754F45254596696984", decimals: 6 },
    ],
  },
  {
    id: "usd1",
    symbol: "USD1",
    name: "World Liberty USD1",
    chains: [
      { chainId: 1, address: "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d", decimals: 18 },
      { chainId: 56, address: "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d", decimals: 18 },
      { chainId: 98866, address: "0x111111d2bf19e43C34263401e0CAd979eD1cdb61", decimals: 18 },
    ],
  },
  {
    id: "usdf",
    symbol: "USDf",
    name: "Falcon USD",
    chains: [
      { chainId: 1, address: "0xFa2B947eEc368f42195f24F36d2aF29f7c24CeC2", decimals: 18 },
      { chainId: 56, address: "0xb3b02E4A9Fb2bD28CC2ff97B0aB3F6B3Ec1eE9D2", decimals: 18 },
    ],
  },
  {
    id: "rlusd",
    symbol: "RLUSD",
    name: "Ripple USD",
    chains: [
      { chainId: 1, address: "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD", decimals: 18 },
    ],
  },
  {
    id: "usdtb",
    symbol: "USDtb",
    name: "USDtb",
    chains: [
      { chainId: 1, address: "0xC139190F447e929f090Edeb554D95AbB8b18aC1C", decimals: 18 },
      { chainId: 8453, address: "0xc708B6887DB46005dA033501f8aeBee72d191a5d", decimals: 18 },
      { chainId: 42161, address: "0xc708B6887DB46005dA033501f8aeBee72d191a5d", decimals: 18 },
    ],
  },
  {
    id: "gho",
    symbol: "GHO",
    name: "Aave GHO",
    chains: [
      { chainId: 1, address: "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f", decimals: 18 },
    ],
  },
  {
    id: "usd0",
    symbol: "USD0",
    name: "Usual USD",
    chains: [
      { chainId: 1, address: "0x73A15FeD60Bf67631dC6cd7Bc5B6e8da8190aCF5", decimals: 18 },
    ],
  },
  {
    id: "usdg",
    symbol: "USDG",
    name: "Global Dollar",
    chains: [
      { chainId: 1, address: "0xe343167631d89B6Ffc58B88d6b7fB0228795491D", decimals: 6 },
    ],
  },
];
