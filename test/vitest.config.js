import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    hookTimeout: 120000,
    include: ["**/test/**/*.test.js"]
  }
});
