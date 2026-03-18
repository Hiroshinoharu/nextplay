import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router-dom")) return "router";
          if (id.includes("@tanstack/react-query")) return "query";
          if (id.includes("styled-components")) return "styled";
          if (id.includes("/react/") || id.includes("/react-dom/")) return "react-vendor";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:18084",
        changeOrigin: true,
        timeout: 60000,
        proxyTimeout: 60000,
      },
    },
  },
})
