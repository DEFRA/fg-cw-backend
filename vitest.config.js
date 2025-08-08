import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      OIDC_JWKS_URI:
        "https://login.microsoftonline.com/common/discovery/v2.0/keys",
      OIDC_VERIFY_ISS: "https://sts.windows.net/common/",
      OIDC_VERIFY_AUD: "api://common",
      TZ: "Europe/London",
    },
    coverage: {
      reporter: ["text", "lcov", "html"],
    },
    mockReset: true,
    testTimeout: 40000,
    hookTimeout: 40000,
  },
});
