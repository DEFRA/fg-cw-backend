// eslint-disable-next-line import-x/no-unresolved
import { defineConfig } from "vitest/config";

const CW_PORT = 3002;
const MONGO_PORT = 27018;
const LOCALSTACK_PORT = 4567;

// eslint-disable-next-line import-x/no-default-export
export default defineConfig({
  test: {
    globalSetup: "./test/setup.js",
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,
    env: {
      CW_PORT,
      MONGO_PORT,
      LOCALSTACK_PORT,
      API_URL: `http://localhost:${CW_PORT}`,
      MONGO_URI: `mongodb://localhost:${MONGO_PORT}/fg-cw-backend`,
      AWS_REGION: "eu-west-2",
      AWS_ENDPOINT_URL: `http://localhost:${LOCALSTACK_PORT}`,
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test",
      CREATE_NEW_CASE_SQS_URL: `http://sqs.eu-west-2.127.0.0.1:${LOCALSTACK_PORT}/000000000000/create_new_case`,
      OIDC_JWKS_URI:
        "https://login.microsoftonline.com/common/discovery/v2.0/keys",
      OIDC_VERIFY_ISS: "https://sts.windows.net/common/",
      OIDC_VERIFY_AUD: "api://common",
    },
    hookTimeout: 120000,
  },
});
