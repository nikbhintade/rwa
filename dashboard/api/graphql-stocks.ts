import { makeGraphqlProxy } from "./_proxy";

export const config = { runtime: "edge" };

// Tokenized-stocks indexer (Backed xStocks + Ondo Global Markets).
export default makeGraphqlProxy("TOKENIZED_STOCKS_ENDPOINT");
