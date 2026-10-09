/* eslint-disable import-x/no-default-export */
import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

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
    setupFiles: [path.resolve(__dirname, "setup.js")],
    exclude: [...configDefaults.exclude, "**/provider.actuators.test.js"],
  },
});
