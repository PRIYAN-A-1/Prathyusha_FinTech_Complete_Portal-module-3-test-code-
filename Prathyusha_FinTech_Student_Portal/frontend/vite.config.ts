import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/auth": {
        target: process.env.AUTH_PROXY_TARGET ?? "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    fileParallelism: false,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
