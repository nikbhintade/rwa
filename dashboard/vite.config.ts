import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const endpoint = env.GRAPHQL_ENDPOINT
  if (!endpoint) {
    throw new Error('GRAPHQL_ENDPOINT missing in .env')
  }
  const url = new URL(endpoint)
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/graphql': {
          target: `${url.protocol}//${url.host}`,
          changeOrigin: true,
          secure: true,
          rewrite: () => url.pathname,
        },
      },
    },
  }
})
