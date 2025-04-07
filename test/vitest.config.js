import { defineConfig } from "vitest/config";

const CW_PORT = 3801;
const MONGO_PORT = 28017;
const AWS_PORT = 4866;
const REDIS_PORT = 6879;

export default defineConfig({
  test: {
    globalSetup: "./test/setup.js",
    env: {
      CW_PORT,
      MONGO_PORT,
      AWS_PORT,
      REDIS_PORT,
      API_URL: `http://localhost:${CW_PORT}`,
      MONGO_URI: `mongodb://localhost:${MONGO_PORT}/fg-cw-backend`
    },
    hookTimeout: 120000,
    include: ["**/test/**/*.test.js"]
  }
});
