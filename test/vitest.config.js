// eslint-disable-next-line import-x/no-unresolved
import { defineConfig } from "vitest/config";

const CW_PORT = 3002;
const MONGO_PORT = 27018;
const LOCALSTACK_PORT = 4567;
const ENTRA_PORT = 3011;

// eslint-disable-next-line import-x/no-default-export
export default defineConfig({
  test: {
    globalSetup: "./test/setup.js",
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,
    reporters: ["default", "html"],
    outputFile: {
      html: "./test/reports/index.html",
    },
    env: {
      CW_PORT,
      MONGO_PORT,
      LOCALSTACK_PORT,
      ENTRA_PORT,
      API_URL: `http://localhost:${CW_PORT}`,
      MONGO_URI: `mongodb://localhost:${MONGO_PORT}/fg-cw-backend`,
      AWS_REGION: "eu-west-2",
      AWS_ENDPOINT_URL: `http://localhost:${LOCALSTACK_PORT}`,
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test",
      CREATE_NEW_CASE_SQS_URL: `http://sqs.eu-west-2.127.0.0.1:${LOCALSTACK_PORT}/000000000000/create_new_case`,
      OIDC_JWKS_URI: "http://entra:3010/jwks", // Container-to-container URL
      OIDC_VERIFY_ISS: "http://localhost:3010", // Token issuer (string match)
      OIDC_VERIFY_AUD: "api://client1",
      OIDC_SIGN_TOKEN_ENDPOINT: `http://localhost:${ENTRA_PORT}/sign`,
    },
    hookTimeout: 120000,
  },
});
