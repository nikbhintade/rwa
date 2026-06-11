## Stablecoins & Treasuries Indexer

Multichain [Envio](https://envio.dev) HyperIndex tracking two ERC20 asset classes across Ethereum and other EVM chains.

### Stablecoins

A basket of fiat-backed stablecoins. Metrics:

- Total supply (mints/burns, incl. non-`Transfer` issue/redeem)
- Holder balances
- Daily aggregates — supply, mint/burn/transfer volume, transfer count, active addresses

### US Treasuries

Tokenised money-market / T-bill funds. Same supply, holder, and daily-aggregate metrics as stablecoins, **plus NAV & yield**:

- **NAV** — per-share net asset value: every change recorded, with a daily 00:00 UTC snapshot.
- **Yield** — annualised yield per update; for $1.00-pinned funds (yield paid as new shares) also a trailing 7-day APY and week-over-week change.

NAV/yield sourcing depends on the token (external oracle vs. share-rebase); see `config.yaml` and `src/handlers/` for per-token wiring.

### Run

```bash
pnpm dev          # GraphQL playground at http://localhost:8080 (password: testing)
pnpm codegen      # regenerate after editing config.yaml or schema.graphql
pnpm test         # vitest
```

### Pre-requisites

- [Node.js v22+ (v24 recommended)](https://nodejs.org/en/download/current)
- [pnpm (v8+)](https://pnpm.io/installation)
- [Docker](https://www.docker.com/products/docker-desktop/) or [Podman](https://podman.io/)
