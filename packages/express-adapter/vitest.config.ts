import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    globals: false,
    fileParallelism: false,
  },
});
