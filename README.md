# RWA Indexers

On-chain metrics for real-world assets — tokenized stablecoins and US Treasuries — with a dashboard to explore them.

Built with [HyperIndex](https://envio.dev).

## Repo layout

| Path | What it is |
|------|------------|
| `indexers/rwa-tokens` | Multichain HyperIndex tracking stablecoins + tokenized US Treasuries |
| `dashboard` | Vite + React UI that queries the indexer's GraphQL API |

## What the indexer tracks

- **Stablecoins** — total supply (mints/burns), holder balances, daily aggregates (supply, mint/burn/transfer volume, transfer count, active addresses).
- **US Treasuries** — the same metrics, plus **NAV & yield**: every NAV change with a daily 00:00 UTC snapshot, annualized yield per update, and (for $1.00-pinned funds whose yield is paid as new shares) a trailing 7-day APY and week-over-week change.

Per-token wiring (which addresses, which NAV source) lives in `indexers/rwa-tokens/config.yaml` and `src/handlers/`.

## Run the indexer

```bash
cd indexers/rwa-tokens
pnpm install
pnpm dev          # GraphQL playground at http://localhost:8080 (password: testing)
```

Other commands: `pnpm codegen` (after editing `config.yaml` or `schema.graphql`), `pnpm test`.

## Run the dashboard

```bash
cd dashboard
cp .env.example .env   # set GRAPHQL_ENDPOINT to your indexer's /v1/graphql URL
npm install
npm run dev
```

`GRAPHQL_ENDPOINT` can be a hosted HyperIndex URL or a local indexer (`http://localhost:8080/v1/graphql`).

## Pre-requisites

- [Node.js v22+ (v24 recommended)](https://nodejs.org/en/download/current)
- [pnpm v8+](https://pnpm.io/installation) (indexer) · npm (dashboard)
- [Docker](https://www.docker.com/products/docker-desktop/) or [Podman](https://podman.io/) (indexer)
