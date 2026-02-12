import { defineConfig } from "vitest/config";

const CW_PORT = 3002;
const MONGO_PORT = 27018;
const LOCALSTACK_PORT = 4567;
const ENTRA_PORT = 3011;

const SQS_URL = `http://sqs.eu-west-2.127.0.0.1:${LOCALSTACK_PORT}/000000000000`;

// eslint-disable-next-line import-x/no-default-export
export default defineConfig({
  test: {
    globalSetup: "./test/setup.js",
    setupFiles: ["./test/cleanup.js"],
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,
    env: {
      CW_PORT,
      MONGO_PORT,
      LOCALSTACK_PORT,
      ENTRA_PORT,
      API_URL: `http://localhost:${CW_PORT}`,
      MONGO_URI: `mongodb://localhost:${MONGO_PORT}/fg-cw-backend?directConnection=true`,
      AWS_REGION: "eu-west-2",
      AWS_ENDPOINT_URL: `http://localhost:${LOCALSTACK_PORT}`,
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test",
      CW__SQS__CREATE_NEW_CASE_URL: `${SQS_URL}/cw__sqs__create_new_case_fifo.fifo`,
      CW__SQS__UPDATE_STATUS_URL: `${SQS_URL}/cw__sqs__update_status_fifo.fifo`,
      GAS__SQS__UPDATE_STATUS: `${SQS_URL}/gas__sqs__update_status_fifo.fifo`, // required for varification purposes only
      OIDC_JWKS_URI: `http://localhost:${ENTRA_PORT}/jwks`,
      OIDC_VERIFY_ISS: `http://localhost:3010`, // Match the actual token issuer from Entra stub
      OIDC_VERIFY_AUD: "api://client1",
      OIDC_SIGN_TOKEN_ENDPOINT: `http://localhost:${ENTRA_PORT}/sign`,
      PRINT_LOGS: process.env.PRINT_LOGS,
      OUTBOX_MAX_RETRIES: 5,
      OUTBOX_CLAIM_MAX_RECORDS: 2,
      OUTBOX_EXPIRES_MS: 5000,
      OUTBOX_POLL_MS: 250,
      INBOX_MAX_RETRIES: 5,
      INBOX_CLAIM_MAX_RECORDS: 2,
      INBOX_EXPIRES_MS: 5000,
      INBOX_POLL_MS: 250,
      ENVIRONMENT: "test",
      RULES_ENGINE_URL:
        "https://ephemeral-protected.api.dev.cdp-int.defra.cloud/land-grants-api",
      RULES_ENGINE_HEADERS: "x-api-key: fake-key",
      FIFO_LOCK_TTL_MS: 5000,
    },
    hookTimeout: 30000,
  },
});
