import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the pure modules, the store and the local backend (plan D8).
// jsdom supplies window/localStorage; fake-indexeddb/auto installs a global
// indexedDB before any test module loads. Tests live next to the code they
// cover, in __tests__/ folders.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["fake-indexeddb/auto", "./vitest.setup.ts"],
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
  },
});
