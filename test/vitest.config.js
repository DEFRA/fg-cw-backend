import { defineConfig } from "vitest/config";

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
      // Infrastructure container ports are dynamically assigned by testcontainers
      // and overridden in test/setup.js. The following are placeholder values.
      PORT: "0", // Use 0 to let OS assign available port
      AWS_REGION: "eu-west-2",
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test",
      // OIDC placeholders (will be overridden by actual container values in setup.js)
      OIDC_JWKS_URI: "http://placeholder:3010/jwks",
      OIDC_VERIFY_ISS: "http://placeholder:3010",
      OIDC_VERIFY_AUD: "api://client1",
      OUTBOX_MAX_RETRIES: "5",
      OUTBOX_CLAIM_MAX_RECORDS: "2",
      OUTBOX_EXPIRES_MS: "5000",
      OUTBOX_POLL_MS: "250",
      INBOX_MAX_RETRIES: "5",
      INBOX_CLAIM_MAX_RECORDS: "2",
      INBOX_EXPIRES_MS: "5000",
      INBOX_POLL_MS: "250",
      ENVIRONMENT: "test",
      RULES_ENGINE_URL:
        "https://ephemeral-protected.api.dev.cdp-int.defra.cloud/land-grants-api",
      RULES_ENGINE_HEADERS: "x-api-key: fake-key",
    },
    hookTimeout: 60000,
  },
});
