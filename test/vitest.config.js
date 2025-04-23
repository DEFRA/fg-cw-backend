import { defineConfig } from "vitest/config";

const CW_PORT = 3801;
const MONGO_PORT = 28017;
const AWS_PORT = 4866;
const REDIS_PORT = 6879;
const SQS_ENDPOINT = "http://localhost.localstack.cloud:4866";
const SNS_ENDPOINT = "http://localhost.localstack.cloud:4866";
const CREATE_NEW_CASE_SQS_URL =
  "http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case";

export default defineConfig({
  test: {
    globalSetup: "./test/setup.js",
    env: {
      CW_PORT,
      MONGO_PORT,
      AWS_PORT,
      SQS_ENDPOINT,
      SNS_ENDPOINT,
      CREATE_NEW_CASE_SQS_URL,
      REDIS_PORT,
      API_URL: `http://localhost:${CW_PORT}`,
      MONGO_URI: `mongodb://localhost:${MONGO_PORT}/fg-cw-backend`
    },
    hookTimeout: 120000,
    include: ["**/test/**/*.test.js"],
    maxThreads: 1
  }
});
