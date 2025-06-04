import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    mockReset: true,
    testTimeout: 40000,
    hookTimeout: 40000
  }
});
