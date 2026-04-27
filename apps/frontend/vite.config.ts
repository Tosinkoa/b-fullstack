import path from "path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Dev: API on the host. Preview (e.g. in Docker): API service on the compose network.
// `docker-compose.yml` sets `PREVIEW_PROXY_TARGET=http://api:3000` for the frontend service.
const devApiProxy = process.env.DEV_API_PROXY_TARGET ?? "http://127.0.0.1:3000"
const previewApiProxy = process.env.PREVIEW_PROXY_TARGET ?? "http://127.0.0.1:3000"

// https://vite.dev/config/
export default defineConfig({
  // Load `VITE_*` from `apps/frontend/.env` (default `envDir` is this file’s directory).
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: devApiProxy,
        changeOrigin: true,
      },
    },
  },
  // `vite preview` does not use `server.proxy`; it needs `preview.proxy` or /api 404s / misproxies in the container.
  preview: {
    proxy: {
      "/api": {
        target: previewApiProxy,
        changeOrigin: true,
      },
    },
  },
})
