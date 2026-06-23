import { makeGraphqlProxy } from "./_proxy";

export const config = { runtime: "edge" };

// Stablecoins / treasuries indexer.
export default makeGraphqlProxy("GRAPHQL_ENDPOINT");
