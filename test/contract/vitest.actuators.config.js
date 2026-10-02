/* eslint-disable import-x/no-default-export */
import { defineConfig } from "vitest/config";
import integration from "../vitest.config.js";

// The actuators pact is HTTP, replayed against the integration harness's
// service and Mongo; vitest.config.js excludes it.
export default defineConfig({
  test: {
    ...integration.test,
    include: ["test/contract/provider.actuators.test.js"],
    exclude: [],
    setupFiles: [],
    testTimeout: 120000,
  },
});
