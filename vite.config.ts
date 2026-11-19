import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { vaultPlugin } from "./build/vaultPlugin";
export default defineConfig({
  plugins: [vaultPlugin(), react()],
  base: "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'react';
        },
      },
    },
  },
  server: { host: "127.0.0.1", port: 5173 },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "build/**/*.test.ts"],
    testTimeout: 20000,
  },
});
