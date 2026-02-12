/* eslint-disable import-x/no-default-export */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    testTimeout: 60000,
    environment: "node",
    globals: true,
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,
  },
});
