import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { rotateApiTokenUseCase } from "../use-cases/rotate-api-token.use-case.js";
import { rotateClientTokenRoute } from "./rotate-client-token.route.js";

vi.mock("../use-cases/rotate-api-token.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const TOKEN_ID = "6650c1f2a9e4b1d07c20bd91";
const CALLER_ID = "6650c1f2a9e4b1d07c20bd99";
const HASH = "e".repeat(64);

const NEW_TOKEN = {
  tokenId: "6650c1f2a9e4b1d07c20bd92",
  clientId: "grants-ui",
  tokenHint: "Nw9_",
  status: "ACTIVE",
  createdAt: "2026-11-04T10:00:00.000Z",
  createdBy: OPERATOR_NAME,
  expiresAt: null,
  revokedAt: null,
  revokedBy: null,
  inUse: false,
};

const ROTATED = { token: NEW_TOKEN, oldExpiresAt: "2026-11-05T23:59:59.000Z" };

const post = async (payload) =>
  (await serverFor(rotateClientTokenRoute)).inject({
    method: "POST",
    url: `/actuators/clients/grants-ui/tokens/${TOKEN_ID}/rotate`,
    headers: asGas({ "x-test-token-id": CALLER_ID }),
    payload,
  });

beforeEach(() => {
  rotateApiTokenUseCase.mockResolvedValue(ROTATED);
});

describe("rotateClientTokenRoute", () => {
  it.each([
    ["no old expiry", { token: NEW_TOKEN }],
    ["anything more", { ...ROTATED, hash: HASH }],
  ])("fails closed with a 500 on an answer with %s", async (_, answer) => {
    rotateApiTokenUseCase.mockResolvedValue(answer);

    const response = await post({
      tokenHash: HASH,
      tokenHint: "Nw9_",
      keepOld: "24h",
    });

    expect(response.statusCode).toBe(500);
    expect(response.payload).not.toContain(HASH);
  });

  it("is a public API POST on the token's rotate", () => {
    expect(rotateClientTokenRoute.method).toBe("POST");
    expect(rotateClientTokenRoute.path).toBe(
      "/actuators/clients/{clientId}/tokens/{tokenId}/rotate",
    );
    expect(rotateClientTokenRoute.options.auth).toBe("public-api");
  });

  it.each(["none", "24h", "7d"])(
    "answers 201 with the new row and the old token's new expiry for keepOld %s",
    async (keepOld) => {
      const response = await post({
        tokenHash: HASH,
        tokenHint: "Nw9_",
        keepOld,
      });

      expect(response.statusCode).toBe(201);
      expect(response.result).toEqual(ROTATED);
      expect(response.payload).not.toContain(HASH);
      expect(rotateApiTokenUseCase).toHaveBeenCalledWith({
        clientId: "grants-ui",
        tokenId: TOKEN_ID,
        tokenHash: HASH,
        tokenHint: "Nw9_",
        keepOld,
        callerTokenId: CALLER_ID,
        operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
        caller: CASE_READER_CLIENT,
      });
    },
  );

  it("answers 400 to any other overlap", async () => {
    const response = await post({
      tokenHash: HASH,
      tokenHint: "Nw9_",
      keepOld: "30d",
    });

    expect(response.statusCode).toBe(400);
    expect(rotateApiTokenUseCase).not.toHaveBeenCalled();
  });

  it("leaves a bad hash to the use case, where the refusal is audited", async () => {
    await post({ tokenHash: "nope", tokenHint: "Nw9_", keepOld: "24h" });

    expect(rotateApiTokenUseCase.mock.calls[0][0].tokenHash).toBe("nope");
  });
});
