import { defineConfig } from "vitest/config";

export default defineConfig({
  // Nest relies on legacy decorators. tsconfig.json excludes test files, so
  // Vite's Oxc transform cannot infer this for the decorators used in tests.
  oxc: {
    decorator: { legacy: true },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    globals: false,
    fileParallelism: false,
  },
});
