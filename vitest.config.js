import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      OIDC_JWKS_URI:
        "https://login.microsoftonline.com/common/discovery/v2.0/keys",
      OIDC_VERIFY_ISS: "https://sts.windows.net/common/",
      OIDC_VERIFY_AUD: "api://common",
      TZ: "Europe/London",
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test",
      OUTBOX_MAX_RETRIES: 5,
      OUTBOX_CLAIM_MAX_RECORDS: 2,
      OUTBOX_EXPIRES_MS: 5000,
      OUTBOX_POLL_MS: 250,
      INBOX_MAX_RETRIES: 5,
      INBOX_CLAIM_MAX_RECORDS: 2,
      INBOX_EXPIRES_MS: 5000,
      INBOX_POLL_MS: 250,
    },
    coverage: {
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.js"],
      exclude: [
        "**/migrations/**",
        "**/src/main.js",
        "**/test/**",
        "**/scripts/**",
      ],
    },
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 40000,
    hookTimeout: 40000,
  },
});
