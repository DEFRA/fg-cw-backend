import { describe, expect, it } from "vitest";
import { AccessToken, apiClientErrors } from "./access-token.js";
import { ApiClient } from "./api-client.js";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const EARLIER = new Date("2026-11-01T09:00:00.000Z");
const HASH = "a".repeat(64);

const revoked = () =>
  AccessToken.createMock({ revokedAt: EARLIER, expiresAt: EARLIER });

const issue = (client, overrides = {}) =>
  client.issueToken({
    tokenHash: HASH,
    tokenHint: "x9Q_",
    newClient: false,
    by: "Jane",
    now: NOW,
    ...overrides,
  });

const errorCodeOf = (call) => {
  try {
    call();
  } catch (error) {
    return [error.output.statusCode, error.output.payload.errorCode];
  }

  return null;
};

describe("ApiClient.issueToken", () => {
  it("issues a token for an existing client, its hash beside it", () => {
    const { token, tokenHash } = issue(ApiClient.createMock());

    expect(tokenHash).toBe(HASH);
    expect(token).not.toHaveProperty("tokenHash");
    expect(token.clientId).toBe("grants-ui");
    expect(token.createdBy).toBe("Jane");
    expect(token.tokenHint).toBe("x9Q_");
  });

  it("creates a client that has no rows when asked to", () => {
    const client = ApiClient.createMock({ tokens: [] });

    expect(issue(client, { newClient: true }).token.clientId).toBe("grants-ui");
  });

  it("issues any number of active tokens", () => {
    const client = ApiClient.createMock({
      tokens: [
        AccessToken.createMock(),
        AccessToken.createMock(),
        AccessToken.createMock(),
      ],
    });

    expect(() => issue(client)).not.toThrow();
  });

  it.each([
    ["upper case", "Grants-UI"],
    ["a space", "grants ui"],
    ["an underscore", "grants_ui"],
    ["nothing", ""],
    ["65 characters", "a".repeat(65)],
    ["64 hex characters, as a hash is", "0123456789abcdef".repeat(4)],
  ])("refuses a name with %s", (_, clientId) => {
    const client = ApiClient.createMock({ clientId, tokens: [] });

    expect(errorCodeOf(() => issue(client, { newClient: true }))).toEqual([
      400,
      apiClientErrors.INVALID_NAME,
    ]);
  });

  it.each([
    ["upper case", "A".repeat(64)],
    ["63 characters", "a".repeat(63)],
    ["65 characters", "a".repeat(65)],
    ["a non-hex character", `${"a".repeat(63)}g`],
    ["nothing", undefined],
  ])("refuses a hash with %s", (_, tokenHash) => {
    expect(
      errorCodeOf(() => issue(ApiClient.createMock(), { tokenHash })),
    ).toEqual([400, apiClientErrors.INVALID_HASH]);
  });

  it.each([
    ["3 characters", "x9Q"],
    ["5 characters", "x9Q_-"],
    ["a character base64url never uses", "x9Q+"],
    ["nothing", undefined],
  ])("refuses a hint with %s", (_, tokenHint) => {
    expect(
      errorCodeOf(() => issue(ApiClient.createMock(), { tokenHint })),
    ).toEqual([400, apiClientErrors.INVALID_HINT]);
  });

  it("accepts any four base64url characters as a hint", () => {
    expect(() =>
      issue(ApiClient.createMock(), { tokenHint: "aZ0-" }),
    ).not.toThrow();
    expect(() =>
      issue(ApiClient.createMock(), { tokenHint: "____" }),
    ).not.toThrow();
  });

  it("issues a token that expires, or one that never does", () => {
    const LATER = new Date("2027-01-01T00:00:00.000Z");

    expect(
      issue(ApiClient.createMock(), { expiresAt: LATER }).token.expiresAt,
    ).toEqual(LATER);
    expect(issue(ApiClient.createMock()).token.expiresAt).toBeNull();
  });

  it("refuses an expiry that has passed", () => {
    expect(
      errorCodeOf(() => issue(ApiClient.createMock(), { expiresAt: EARLIER })),
    ).toEqual([400, apiClientErrors.INVALID_EXPIRY]);
  });

  it("refuses to create a client whose name has any row, even revoked", () => {
    const client = ApiClient.createMock({ tokens: [revoked()] });

    expect(errorCodeOf(() => issue(client, { newClient: true }))).toEqual([
      409,
      apiClientErrors.CLIENT_EXISTS,
    ]);
  });

  it("refuses to issue for a client with no rows unless creating it", () => {
    const client = ApiClient.createMock({ tokens: [] });

    expect(errorCodeOf(() => issue(client))).toEqual([
      404,
      apiClientErrors.CLIENT_NOT_FOUND,
    ]);
  });
});
