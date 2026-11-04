import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const convexSiteUrl = env.VITE_CONVEX_SITE_URL ?? 'http://localhost:3211'

  return {
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    // Force a single React instance across app + SSR smoke harness.
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    port: 5173,
    open: false,
    // Proxy Better Auth routes through Vite so the session cookie is
    // same-origin (localhost:5173 → localhost:3211). Without this the
    // browser rejects the cross-origin Set-Cookie header.
    proxy: {
      '/api/auth': {
        target: convexSiteUrl,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // Keep React external in SSR so the smoke harness and the app share one React
  // instance (avoids "Invalid hook call" from duplicate React copies).
  ssr: {
    external: ['react', 'react-dom', 'react-router-dom'],
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
};
});