// vite.config.ts
import { defineConfig, loadEnv } from "file:///C:/Users/Nathy.Dev/Desktop/Web%20projects/HYPREP/Freedom%20of%20Information%20(FOI)%20Management%20System/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Nathy.Dev/Desktop/Web%20projects/HYPREP/Freedom%20of%20Information%20(FOI)%20Management%20System/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "node:path";
var __vite_injected_original_dirname = "C:\\Users\\Nathy.Dev\\Desktop\\Web projects\\HYPREP\\Freedom of Information (FOI) Management System";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const convexSiteUrl = env.VITE_CONVEX_SITE_URL ?? "http://localhost:3211";
  return {
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(__vite_injected_original_dirname, "./src") },
      // Force a single React instance across app + SSR smoke harness.
      dedupe: ["react", "react-dom", "react-router-dom"]
    },
    server: {
      port: 5173,
      open: false,
      // Proxy Better Auth routes through Vite so the session cookie is
      // same-origin (localhost:5173 → localhost:3211). Without this the
      // browser rejects the cross-origin Set-Cookie header.
      proxy: {
        "/api/auth": {
          target: convexSiteUrl,
          changeOrigin: true,
          secure: false
        }
      }
    },
    // Keep React external in SSR so the smoke harness and the app share one React
    // instance (avoids "Invalid hook call" from duplicate React copies).
    ssr: {
      external: ["react", "react-dom", "react-router-dom"]
    },
    build: {
      outDir: "dist",
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            charts: ["recharts"]
          }
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxOYXRoeS5EZXZcXFxcRGVza3RvcFxcXFxXZWIgcHJvamVjdHNcXFxcSFlQUkVQXFxcXEZyZWVkb20gb2YgSW5mb3JtYXRpb24gKEZPSSkgTWFuYWdlbWVudCBTeXN0ZW1cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXE5hdGh5LkRldlxcXFxEZXNrdG9wXFxcXFdlYiBwcm9qZWN0c1xcXFxIWVBSRVBcXFxcRnJlZWRvbSBvZiBJbmZvcm1hdGlvbiAoRk9JKSBNYW5hZ2VtZW50IFN5c3RlbVxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvTmF0aHkuRGV2L0Rlc2t0b3AvV2ViJTIwcHJvamVjdHMvSFlQUkVQL0ZyZWVkb20lMjBvZiUyMEluZm9ybWF0aW9uJTIwKEZPSSklMjBNYW5hZ2VtZW50JTIwU3lzdGVtL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCdcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKVxuICBjb25zdCBjb252ZXhTaXRlVXJsID0gZW52LlZJVEVfQ09OVkVYX1NJVEVfVVJMID8/ICdodHRwOi8vbG9jYWxob3N0OjMyMTEnXG5cbiAgcmV0dXJuIHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHsgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSB9LFxuICAgIC8vIEZvcmNlIGEgc2luZ2xlIFJlYWN0IGluc3RhbmNlIGFjcm9zcyBhcHAgKyBTU1Igc21va2UgaGFybmVzcy5cbiAgICBkZWR1cGU6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBvcGVuOiBmYWxzZSxcbiAgICAvLyBQcm94eSBCZXR0ZXIgQXV0aCByb3V0ZXMgdGhyb3VnaCBWaXRlIHNvIHRoZSBzZXNzaW9uIGNvb2tpZSBpc1xuICAgIC8vIHNhbWUtb3JpZ2luIChsb2NhbGhvc3Q6NTE3MyBcdTIxOTIgbG9jYWxob3N0OjMyMTEpLiBXaXRob3V0IHRoaXMgdGhlXG4gICAgLy8gYnJvd3NlciByZWplY3RzIHRoZSBjcm9zcy1vcmlnaW4gU2V0LUNvb2tpZSBoZWFkZXIuXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpL2F1dGgnOiB7XG4gICAgICAgIHRhcmdldDogY29udmV4U2l0ZVVybCxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICAvLyBLZWVwIFJlYWN0IGV4dGVybmFsIGluIFNTUiBzbyB0aGUgc21va2UgaGFybmVzcyBhbmQgdGhlIGFwcCBzaGFyZSBvbmUgUmVhY3RcbiAgLy8gaW5zdGFuY2UgKGF2b2lkcyBcIkludmFsaWQgaG9vayBjYWxsXCIgZnJvbSBkdXBsaWNhdGUgUmVhY3QgY29waWVzKS5cbiAgc3NyOiB7XG4gICAgZXh0ZXJuYWw6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEyMDAsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgIHJlYWN0OiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXG4gICAgICAgICAgY2hhcnRzOiBbJ3JlY2hhcnRzJ10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59O1xufSk7Il0sCiAgIm1hcHBpbmdzIjogIjtBQUFtZSxTQUFTLGNBQWMsZUFBZTtBQUN6Z0IsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUZqQixJQUFNLG1DQUFtQztBQUl6QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxRQUFNLE1BQU0sUUFBUSxNQUFNLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDM0MsUUFBTSxnQkFBZ0IsSUFBSSx3QkFBd0I7QUFFbEQsU0FBTztBQUFBLElBQ1AsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLElBQ2pCLFNBQVM7QUFBQSxNQUNQLE9BQU8sRUFBRSxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPLEVBQUU7QUFBQTtBQUFBLE1BRS9DLFFBQVEsQ0FBQyxTQUFTLGFBQWEsa0JBQWtCO0FBQUEsSUFDbkQ7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQTtBQUFBO0FBQUE7QUFBQSxNQUlOLE9BQU87QUFBQSxRQUNMLGFBQWE7QUFBQSxVQUNYLFFBQVE7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxRQUNWO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQTtBQUFBO0FBQUEsSUFHQSxLQUFLO0FBQUEsTUFDSCxVQUFVLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLElBQ3JEO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUix1QkFBdUI7QUFBQSxNQUN2QixlQUFlO0FBQUEsUUFDYixRQUFRO0FBQUEsVUFDTixjQUFjO0FBQUEsWUFDWixPQUFPLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFlBQ2hELFFBQVEsQ0FBQyxVQUFVO0FBQUEsVUFDckI7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0EsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
