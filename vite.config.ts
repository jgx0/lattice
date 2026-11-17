import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { vaultPlugin } from "./build/vaultPlugin";
export default defineConfig({
  plugins: [vaultPlugin(), react()],
  base: "/",
  server: { host: "0.0.0.0", port: 5173 },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "build/**/*.test.ts"],
    testTimeout: 20000,
  },
});
