import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { logger } from "../../common/logger.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { issueApiTokenUseCase } from "../use-cases/issue-api-token.use-case.js";
import { issueClientTokenRoute } from "./issue-client-token.route.js";

vi.mock("../use-cases/issue-api-token.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const HASH = "e".repeat(64);

const TOKEN = {
  tokenId: "6650c1f2a9e4b1d07c20bd91",
  clientId: "grants-ui",
  tokenHint: "x9Q_",
  status: "ACTIVE",
  createdAt: "2026-11-04T10:00:00.000Z",
  createdBy: OPERATOR_NAME,
  expiresAt: null,
  revokedAt: null,
  revokedBy: null,
  inUse: false,
};

const post = async (payload, name = "grants-ui", headers = asGas()) =>
  (await serverFor(issueClientTokenRoute)).inject({
    method: "POST",
    url: `/actuators/clients/${name}/tokens`,
    headers,
    payload,
  });

beforeEach(() => {
  issueApiTokenUseCase.mockResolvedValue({ token: TOKEN });
});

describe("issueClientTokenRoute", () => {
  it("is a public API POST under its client", () => {
    expect(issueClientTokenRoute.method).toBe("POST");
    expect(issueClientTokenRoute.path).toBe(
      "/actuators/clients/{clientId}/tokens",
    );
    expect(issueClientTokenRoute.options.auth).toBe("public-api");
  });

  it("answers 201 with the token, never its hash", async () => {
    const response = await post({
      tokenHash: HASH,
      tokenHint: "x9Q_",
      newClient: true,
    });

    expect(response.statusCode).toBe(201);
    expect(response.result).toEqual({ token: TOKEN });
    expect(response.payload).not.toContain(HASH);
    expect(issueApiTokenUseCase).toHaveBeenCalledWith({
      clientId: "grants-ui",
      tokenHash: HASH,
      tokenHint: "x9Q_",
      expiresAt: null,
      newClient: true,
      operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
      caller: CASE_READER_CLIENT,
    });
  });

  it("issues for an existing client unless told to create one", async () => {
    await post({ tokenHash: HASH, tokenHint: "x9Q_" });

    expect(issueApiTokenUseCase.mock.calls[0][0].newClient).toBe(false);
  });

  // The model refuses them inside the use case, where the refusal is audited.
  it.each([
    ["a hash in upper case", { tokenHash: "A".repeat(64), tokenHint: "x9Q_" }],
    [
      "a raw token for a hash",
      { tokenHash: "0f9a3c7e-4b21", tokenHint: "x9Q_" },
    ],
    ["a 3-character hint", { tokenHash: HASH, tokenHint: "x9Q" }],
    ["no hint", { tokenHash: HASH }],
  ])("leaves %s to the use case", async (_, payload) => {
    await post(payload);

    expect(issueApiTokenUseCase).toHaveBeenCalledOnce();
  });

  it("leaves a name that fails the rule to the use case", async () => {
    await post({ tokenHash: HASH, tokenHint: "x9Q_" }, "Bad_Name");

    expect(issueApiTokenUseCase.mock.calls[0][0].clientId).toBe("Bad_Name");
  });

  it("never logs a refused hash", async () => {
    await post({ tokenHash: 42, tokenHint: "x9Q_" });

    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("42");
  });

  it("passes an expiry as a Date", async () => {
    await post({
      tokenHash: HASH,
      tokenHint: "x9Q_",
      expiresAt: "2999-01-01T00:00:00.000Z",
    });

    expect(issueApiTokenUseCase.mock.calls[0][0].expiresAt).toEqual(
      new Date("2999-01-01T00:00:00.000Z"),
    );
  });

  it("answers 400 API_TOKEN_INVALID_EXPIRY to an expiry that is not a date", async () => {
    const response = await post({
      tokenHash: HASH,
      tokenHint: "x9Q_",
      expiresAt: "soon",
    });

    expect(response.statusCode).toBe(400);
    expect(response.result.errorCode).toBe("API_TOKEN_INVALID_EXPIRY");
  });

  it("answers 400 to a body with any other field", async () => {
    const response = await post({
      tokenHash: HASH,
      tokenHint: "x9Q_",
      seeded: true,
    });

    expect(response.statusCode).toBe(400);
    expect(response.result.errorCode).toBeUndefined();
  });

  it("answers 400 without the operator", async () => {
    const response = await post({ tokenHash: HASH }, "grants-ui", {
      "x-test-client": CASE_READER_CLIENT,
    });

    expect(response.statusCode).toBe(400);
  });

  it("answers 400 to an operator name holding a hash, storing nothing", async () => {
    const response = await post(
      { tokenHash: HASH },
      "grants-ui",
      asGas({ "x-actor": "d".repeat(64) }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.payload).not.toContain("d".repeat(64));
    expect(issueApiTokenUseCase).not.toHaveBeenCalled();
  });

  it("fails closed with a 500 rather than send the hash back", async () => {
    issueApiTokenUseCase.mockResolvedValue({ token: { ...TOKEN, id: HASH } });

    const response = await post({ tokenHash: HASH, tokenHint: "x9Q_" });

    expect(response.statusCode).toBe(500);
    expect(response.payload).not.toContain(HASH);
  });
});
