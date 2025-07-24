import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "lcov", "html"],
    },
    mockReset: true,
    testTimeout: 40000,
    hookTimeout: 40000,
  },
});
