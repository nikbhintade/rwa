## Tokenized Stocks Indexer

Multichain [Envio](https://envio.dev) HyperIndex tracking tokenized equities from two
issuers across Ethereum, Arbitrum, Optimism, BSC, Mantle, Ink, and HyperEVM.

- **Backed Finance xStocks** — `STRCx`, `TSLAx`, `CRCLx`. 1:1 backed; same token
  address on every chain.
- **Ondo Global Markets** (`*on`) — `SPYon`, `QQQon`, `NVDAon`, `IVVon`, `MUon`,
  `CRCLon`, `HIMSon`. Total-return tokens; a per-token sValue multiplier folds
  dividends/corporate actions into the price. One address per chain.

### Metrics (per token, per chain)

Standard ERC-20 supply/holder tracking from `Transfer` (zero-address mints/burns):

- Total supply
- Holder balances (`HolderBalance`)
- Daily aggregates (`TokenDayData`) — supply snapshot, mint/burn/transfer volume,
  transfer count, active addresses

### On-chain NAV

NAV per token comes from **Chainlink push price aggregators** (`AnswerUpdated`,
8-decimal USD, step function) — no off-chain calls. The aggregator (not the proxy)
emits the event, so the aggregator address is indexed (resolve via `aggregator()` on
the feed proxy).

- **xStocks** — the underlying equity feed *is* the NAV, since the token is 1:1
  backed and carries no multiplier (e.g. `TSLA / USD` → `TSLAx`).
- **Ondo `*on`** — the per-token `XXXon-USD (Calculated)` feed *is* the NAV;
  Chainlink already bakes the `SyntheticSharesOracle` sValue multiplier into it.

Produces `NavUpdate` (every print), `NavDailySnapshot` (00:00 UTC, backfilled), and
`NavOracleState` (latest), keyed by token symbol so any chain's token rows join to it.

**Wired feeds (5):** `SPYon`, `QQQon` (Ondo Calculated — multiplier baked in),
`TSLAx`, `STRCx` (underlying = NAV, 1:1), and `NVDAon` (interim: underlying `NVDA`
feed; sValue multiplier omitted, ~1.0 for a non-dividend stock).

**Not indexable (4):** `CRCLon`, `MUon`, `IVVon`, `HIMSon` — and the `CRCL`
underlying for `CRCLx`. No on-chain push feed exists for these; Chainlink serves them
via pull-based **Data Streams**, which emit no continuous on-chain `AnswerUpdated`.
The Ondo GM token CSV (docs.ondo.finance/addresses) lists token addresses only — no
oracle/feed column — so it can't supply these. When a push `(Calculated)` feed is
published: resolve `aggregator()` on the proxy, add it to `config.yaml`
(`ChainlinkNavFeed`), and map it to a symbol in `src/handlers/ChainlinkNav.ts`. See
the comments in both files.

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
