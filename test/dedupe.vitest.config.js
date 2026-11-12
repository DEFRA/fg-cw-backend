import { randomUUID } from "node:crypto";
import { defineConfig } from "vitest/config";
import base from "../vitest.config.js";

// eslint-disable-next-line import-x/no-default-export -- Vitest configuration requires a default export.
export default defineConfig({
  test: {
    ...base.test,
    include: ["test/dedupe.mongo.test.js"],
    env: {
      ...base.test.env,
      MONGO_URI:
        process.env.SPIKE_MONGO_URI ??
        "mongodb://127.0.0.1:27017/?directConnection=true",
      MONGO_DATABASE: `fgp1594-spike-tests-${randomUUID().slice(0, 8)}`,
    },
  },
});
