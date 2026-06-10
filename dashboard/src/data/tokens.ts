import type { Token } from "../types";

// Logical tokens with their per-chain deployments. Decimals are per deployment:
// most bridged USDC is 6, but e.g. Binance-Peg USDC on BNB Chain is 18.
// Symbols/decimals verified on-chain — note the indexer config's address
// comments are not always correct (Arbitrum 0x4685… is PYUSD, not DAI).
//
// `assetClass` is dashboard-side classification only; it is never sent in a
// GraphQL query (the indexer is queried by address). US Treasuries are listed
// but gated off in the UI for now.
export const tokens: Token[] = [
  {
    id: "usdt",
    symbol: "USDT",
    name: "Tether USD",
    assetClass: "stablecoin",
    // Binance-Peg USDT on BNB Chain is 18 decimals; every other deployment is 6.
    // Only Ethereum is indexed for now; the other chains are gated off in the UI.
    chains: [
      { chainId: 1, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
      { chainId: 10, address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6, indexed: false },
      { chainId: 56, address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, indexed: false },
      { chainId: 137, address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, indexed: false },
      { chainId: 4217, address: "0x20C00000000000000000000014f22CA97301EB73", decimals: 6, indexed: false },
      { chainId: 42161, address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, indexed: false },
      { chainId: 42220, address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6, indexed: false },
      { chainId: 43114, address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6, indexed: false },
      { chainId: 98866, address: "0xda6087E69C51E7D31b6DBAD276a3c44703DFdCAd", decimals: 6, indexed: false },
    ],
  },
  {
    id: "usdc",
    symbol: "USDC",
    name: "USD Coin",
    assetClass: "stablecoin",
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
    assetClass: "stablecoin",
    chains: [
      { chainId: 1, address: "0xdC035D45d973E3EC169d2276DDab16f1e407384F", decimals: 18 },
    ],
  },
  {
    id: "usde",
    symbol: "USDe",
    name: "Ethena USD",
    assetClass: "stablecoin",
    chains: [
      { chainId: 1, address: "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3", decimals: 18 },
      { chainId: 43114, address: "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34", decimals: 18 },
    ],
  },
  {
    id: "dai",
    symbol: "DAI",
    name: "Dai Stablecoin",
    assetClass: "stablecoin",
    chains: [
      { chainId: 1, address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
      { chainId: 137, address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
    ],
  },
  {
    id: "pyusd",
    symbol: "PYUSD",
    name: "PayPal USD",
    assetClass: "stablecoin",
    chains: [
      { chainId: 1, address: "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8", decimals: 6 },
      { chainId: 42161, address: "0x46850aD61C2B7d64d08c9C754F45254596696984", decimals: 6 },
    ],
  },
  {
    id: "usd1",
    symbol: "USD1",
    name: "World Liberty USD1",
    assetClass: "stablecoin",
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
    assetClass: "stablecoin",
    chains: [
      { chainId: 1, address: "0xFa2B947eEc368f42195f24F36d2aF29f7c24CeC2", decimals: 18 },
      { chainId: 56, address: "0xb3b02E4A9Fb2bD28CC2ff97B0aB3F6B3Ec1eE9D2", decimals: 18 },
    ],
  },
  {
    id: "rlusd",
    symbol: "RLUSD",
    name: "Ripple USD",
    assetClass: "stablecoin",
    chains: [
      { chainId: 1, address: "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD", decimals: 18 },
    ],
  },
  {
    id: "usdtb",
    symbol: "USDtb",
    name: "USDtb",
    assetClass: "stablecoin",
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
    assetClass: "stablecoin",
    chains: [
      { chainId: 1, address: "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f", decimals: 18 },
    ],
  },
  {
    id: "usd0",
    symbol: "USD0",
    name: "Usual USD",
    assetClass: "stablecoin",
    chains: [
      { chainId: 1, address: "0x73A15FeD60Bf67631dC6cd7Bc5B6e8da8190aCF5", decimals: 18 },
    ],
  },
  {
    id: "usdg",
    symbol: "USDG",
    name: "Global Dollar",
    assetClass: "stablecoin",
    chains: [
      { chainId: 1, address: "0xe343167631d89B6Ffc58B88d6b7fB0228795491D", decimals: 6 },
    ],
  },

  // --- US Treasuries (tokenised money-market / T-bill funds) ---
  {
    id: "usyc",
    symbol: "USYC",
    name: "Circle USYC",
    assetClass: "treasury",
    chains: [
      { chainId: 1, address: "0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b", decimals: 6 },
      { chainId: 56, address: "0x8D0fA28f221eB5735BC71d3a0Da67EE5bC821311", decimals: 6 },
    ],
  },
  {
    id: "buidl",
    symbol: "BUIDL",
    name: "BlackRock USD Institutional Digital Liquidity Fund",
    assetClass: "treasury",
    chains: [
      { chainId: 1, address: "0x6a9DA2D710BB9B700acde7Cb81F10F1fF8C89041", decimals: 6 }, // BUIDL-I
      { chainId: 1, address: "0x7712c34205737192402172409a8F7ccef8aA2AEc", decimals: 6 },
      { chainId: 10, address: "0xa1CDAb15bBA75a80dF4089CaFbA013e376957cF5", decimals: 6 },
      { chainId: 56, address: "0x2D5BdC96D9C8AabBDB38c9A27398513e7E5ef84F", decimals: 6 },
      { chainId: 137, address: "0x2893Ef551B6dD69F661Ac00F11D93E5Dc5Dc0e99", decimals: 6 },
      { chainId: 42161, address: "0xA6525Ae43eDCd03dC08E775774dCAbd3bb925872", decimals: 6 },
      { chainId: 43114, address: "0x53FC82f14F009009b440a706e31c9021E1196A2F", decimals: 6 },
    ],
  },
  {
    id: "usdy",
    symbol: "USDY",
    name: "Ondo U.S. Dollar Yield",
    assetClass: "treasury",
    chains: [
      { chainId: 1, address: "0x96F6eF951840721AdBF46Ac996b59E0235CB985C", decimals: 18 },
      { chainId: 1, address: "0xe86845788d6e3E5C2393ADe1a051AE617D974C09", decimals: 18 }, // USDYc
      { chainId: 1329, address: "0x54cD901491AeF397084453F4372B93c33260e2A6", decimals: 18 },
      { chainId: 5000, address: "0x5bE26527e817998A7206475496fDE1E68957c5A6", decimals: 18 },
      { chainId: 42161, address: "0x35e050d3C0eC2d29D269a8EcEa763a183bDF9A9D", decimals: 18 },
      { chainId: 98866, address: "0xD2B65e851Be3d80D3c2ce795eB2E78f16cB088b2", decimals: 18 },
    ],
  },
  {
    id: "ibenji",
    symbol: "iBENJI",
    name: "iBENJI",
    assetClass: "treasury",
    chains: [
      { chainId: 1, address: "0x90276e9d4A023b5229E0C2e9D4b2a83fe3A2b48c", decimals: 18 },
      { chainId: 56, address: "0x3d0a2A3a30a43a2C1C4b92033609245E819ae6a6", decimals: 18 },
    ],
  },
  {
    id: "wtgxx",
    symbol: "WTGXX",
    name: "WisdomTree Treasury Money Market Digital Fund",
    assetClass: "treasury",
    chains: [
      { chainId: 1, address: "0x1feCF3d9d4Fee7f2c02917A66028a48C6706c179", decimals: 18 },
      { chainId: 10, address: "0x870FD36B3bf7f5abeEEa2C8D4abdF1dc4E33109d", decimals: 18 },
      { chainId: 8453, address: "0x5096b85Ed11798fDdCB8b5CB27C399c04689c435", decimals: 18 },
      { chainId: 42161, address: "0xFEb26F0943C3885B2CB85A9F933975356c81C33d", decimals: 18 },
      { chainId: 43114, address: "0x870FD36B3bf7f5abeEEa2C8D4abdF1dc4E33109d", decimals: 18 },
      { chainId: 98866, address: "0xCF7a8813bD3bdAF70A9f46d310Ce1EE8D80a4F5a", decimals: 18 },
    ],
  },
  {
    id: "jtrsy",
    symbol: "JTRSY",
    name: "Janus Henderson Anemoy Treasury Fund",
    assetClass: "treasury",
    chains: [
      { chainId: 1, address: "0x8c213ee79581Ff4984583C6a801e5263418C4b86", decimals: 6 },
      { chainId: 56, address: "0xa5d465251fBCc907f5Dd6bB2145488DFC6a2627b", decimals: 6 },
      { chainId: 8453, address: "0x8c213ee79581Ff4984583C6a801e5263418C4b86", decimals: 6 },
      { chainId: 42161, address: "0x8c213ee79581Ff4984583C6a801e5263418C4b86", decimals: 6 },
      { chainId: 42220, address: "0x27e8C820d05aEa8824b1aC35116f63f9833b54C8", decimals: 6 },
      { chainId: 43114, address: "0xa5d465251fBCc907f5Dd6bB2145488DFC6a2627b", decimals: 6 },
      { chainId: 98866, address: "0xa5d465251fBCc907f5Dd6bB2145488DFC6a2627b", decimals: 6 },
    ],
  },
  {
    id: "benji",
    symbol: "BENJI",
    name: "Franklin OnChain U.S. Government Money Fund",
    assetClass: "treasury",
    chains: [
      { chainId: 1, address: "0x3DDc84940Ab509C11B20B76B466933f40b750dc9", decimals: 18 },
      { chainId: 137, address: "0x408A634B8a8f0dE729B48574a3a7Ec3fE820B00A", decimals: 18 },
      { chainId: 8453, address: "0x60CfC2b186a4CF647486e42c42B11cC6D571d1E4", decimals: 18 },
      { chainId: 42161, address: "0xB9e4765BCE2609bC1949592059B17Ea72fEe6C6A", decimals: 18 },
      { chainId: 43114, address: "0xE08b4c1005603427420e64252a8b120cacE4D122", decimals: 18 },
    ],
  },
  {
    id: "ustb",
    symbol: "USTB",
    name: "Invesco Short Duration US Government Securities Fund",
    assetClass: "treasury",
    chains: [
      { chainId: 1, address: "0x43415eB6ff9DB7E26A15b704e7A3eDCe97d31C4e", decimals: 6 },
      { chainId: 98866, address: "0xE4fA682f94610cCd170680cc3B045d77D9E528a8", decimals: 6 },
    ],
  },
  {
    id: "ousg",
    symbol: "OUSG",
    name: "Ondo Short-Term US Government Bond Fund",
    assetClass: "treasury",
    chains: [
      { chainId: 1, address: "0x1B19C19393e2d034D8Ff31ff34c81252FcBbee92", decimals: 18 },
      { chainId: 137, address: "0xbA11C5effA33c4D6F8f593CFA394241CfE925811", decimals: 18 },
    ],
  },
  {
    id: "cumiu",
    symbol: "CUMIU",
    name: "ChinaAMC USD Digital Money Market Fund Class I USD",
    assetClass: "treasury",
    chains: [
      { chainId: 1, address: "0x85D38585c3aC08268F598282a84b7c0Ddfc0d04F", decimals: 18 },
    ],
  },
  {
    id: "ustbl",
    symbol: "USTBL",
    name: "Spiko US T-Bills Money Market Fund",
    assetClass: "treasury",
    // Spiko USTBL is 5 decimals, not the usual 6.
    chains: [
      { chainId: 1, address: "0xe4880249745eAc5F1eD9d8F7DF844792D560e750", decimals: 5 },
      { chainId: 137, address: "0xe4880249745eAc5F1eD9d8F7DF844792D560e750", decimals: 5 },
      { chainId: 8453, address: "0xe4880249745eAc5F1eD9d8F7DF844792D560e750", decimals: 5 },
      { chainId: 42161, address: "0x021289588cd81dC1AC87ea91e91607eEF68303F5", decimals: 5 },
    ],
  },
  {
    id: "fdit",
    symbol: "FDIT",
    name: "Fidelity Digital Interest Token",
    assetClass: "treasury",
    chains: [
      { chainId: 1, address: "0x48aB4e39AC59F4E88974804B04A991b3a402717f", decimals: 18 },
    ],
  },
];
