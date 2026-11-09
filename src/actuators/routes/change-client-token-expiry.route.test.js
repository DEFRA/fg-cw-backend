import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { changeApiTokenExpiryUseCase } from "../use-cases/change-api-token-expiry.use-case.js";
import { changeClientTokenExpiryRoute } from "./change-client-token-expiry.route.js";

vi.mock("../use-cases/change-api-token-expiry.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const TOKEN_ID = "6650c1f2a9e4b1d07c20bd91";
const CALLER_ID = "6650c1f2a9e4b1d07c20bd99";
const LATER = "2999-01-01T00:00:00.000Z";

const TOKEN = {
  tokenId: TOKEN_ID,
  clientId: "grants-ui",
  tokenHint: "x9Q_",
  status: "ACTIVE",
  createdAt: null,
  createdBy: null,
  expiresAt: LATER,
  revokedAt: null,
  revokedBy: null,
  inUse: false,
};

const CHANGED = {
  token: TOKEN,
  previousExpiresAt: "2026-01-01T00:00:00.000Z",
  revived: true,
};

const put = async (payload) =>
  (await serverFor(changeClientTokenExpiryRoute)).inject({
    method: "PUT",
    url: `/actuators/clients/grants-ui/tokens/${TOKEN_ID}/expiry`,
    headers: asGas({ "x-test-token-id": CALLER_ID }),
    payload,
  });

beforeEach(() => {
  changeApiTokenExpiryUseCase.mockResolvedValue(CHANGED);
});

describe("changeClientTokenExpiryRoute", () => {
  it.each([
    ["no previous expiry field", { token: TOKEN, revived: false }],
    ["no revived flag", { token: TOKEN, previousExpiresAt: null }],
    ["anything more", { ...CHANGED, asRead: {} }],
  ])("fails closed with a 500 on an answer with %s", async (_, answer) => {
    changeApiTokenExpiryUseCase.mockResolvedValue(answer);

    expect((await put({ expiresAt: LATER })).statusCode).toBe(500);
  });

  it("is a public API PUT on the token's expiry", () => {
    expect(changeClientTokenExpiryRoute.method).toBe("PUT");
    expect(changeClientTokenExpiryRoute.path).toBe(
      "/actuators/clients/{clientId}/tokens/{tokenId}/expiry",
    );
    expect(changeClientTokenExpiryRoute.options.auth).toBe("public-api");
  });

  it("passes the date as a Date and answers the row, its previous expiry and whether it revived", async () => {
    const response = await put({ expiresAt: LATER });

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(CHANGED);
    expect(changeApiTokenExpiryUseCase).toHaveBeenCalledWith({
      clientId: "grants-ui",
      tokenId: TOKEN_ID,
      expiresAt: new Date(LATER),
      callerTokenId: CALLER_ID,
      operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
      caller: CASE_READER_CLIENT,
    });
  });

  it("passes never as null", async () => {
    await put({ expiresAt: null });

    expect(changeApiTokenExpiryUseCase.mock.calls[0][0].expiresAt).toBeNull();
  });

  it.each([
    ["missing", {}],
    ["not a date", { expiresAt: "next week" }],
  ])(
    "answers 400 API_TOKEN_INVALID_EXPIRY to an expiry %s",
    async (_, payload) => {
      const response = await put(payload);

      expect(response.statusCode).toBe(400);
      expect(response.result.errorCode).toBe("API_TOKEN_INVALID_EXPIRY");
      expect(changeApiTokenExpiryUseCase).not.toHaveBeenCalled();
    },
  );
});
