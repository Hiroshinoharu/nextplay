import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const stripApiPrefix = (path: string) => path.replace(/^\/api/, "")

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api/games": {
        target: "http://127.0.0.1:8081",
        changeOrigin: true,
        rewrite: stripApiPrefix,
      },
      "/api/users": {
        target: "http://127.0.0.1:8083",
        changeOrigin: true,
        rewrite: stripApiPrefix,
      },
      "/api/recommend": {
        target: "http://127.0.0.1:8082",
        changeOrigin: true,
        rewrite: stripApiPrefix,
      },
      "/api/health": {
        target: "http://127.0.0.1:8083",
        changeOrigin: true,
        rewrite: () => "/health",
      },
    },
  },
})
