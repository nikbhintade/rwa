import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Each indexer is proxied under its own /api path -> upstream GraphQL endpoint.
  // The stablecoins endpoint is required; the tokenized-stocks one is optional,
  // so the app still runs (stablecoins only) when it isn't configured.
  //
  // Contexts are anchored regexes: vite matches plain-string keys by prefix, and
  // "/api/graphql" is a prefix of "/api/graphql-stocks", which would otherwise
  // misroute stock requests to the stablecoin upstream.
  const proxy: Record<string, ProxyOptions> = {}
  const route = (context: string, endpoint: string | undefined, required: boolean) => {
    if (!endpoint) {
      if (required) throw new Error(`${context}: endpoint missing in .env`)
      return
    }
    const url = new URL(endpoint)
    proxy[context] = {
      target: `${url.protocol}//${url.host}`,
      changeOrigin: true,
      secure: true,
      rewrite: () => url.pathname,
    }
  }
  route('^/api/graphql$', env.GRAPHQL_ENDPOINT, true)
  route('^/api/graphql-stocks$', env.TOKENIZED_STOCKS_ENDPOINT, false)

  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
  }
})
