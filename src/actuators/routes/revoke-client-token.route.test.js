import Boom from "@hapi/boom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { withErrorCode } from "../../common/with-error-code.js";
import { revokeApiTokenUseCase } from "../use-cases/revoke-api-token.use-case.js";
import { revokeClientTokenRoute } from "./revoke-client-token.route.js";

vi.mock("../use-cases/revoke-api-token.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const CALLER_ID = "6650c1f2a9e4b1d07c20bd99";
const TOKEN_ID = "6650c1f2a9e4b1d07c20bd91";

const post = async (
  url = `/actuators/clients/grants-ui/tokens/${TOKEN_ID}/revoke`,
) =>
  (await serverFor(revokeClientTokenRoute)).inject({
    method: "POST",
    url,
    headers: asGas({ "x-test-token-id": CALLER_ID }),
  });

beforeEach(() => {
  revokeApiTokenUseCase.mockResolvedValue();
});

describe("revokeClientTokenRoute", () => {
  it("is a public API POST under its token", () => {
    expect(revokeClientTokenRoute.method).toBe("POST");
    expect(revokeClientTokenRoute.path).toBe(
      "/actuators/clients/{clientId}/tokens/{tokenId}/revoke",
    );
    expect(revokeClientTokenRoute.options.auth).toBe("public-api");
  });

  it("answers 204 with no body, passing the caller's token", async () => {
    const response = await post();

    expect(response.statusCode).toBe(204);
    expect(response.payload).toBe("");
    expect(revokeApiTokenUseCase).toHaveBeenCalledWith({
      clientId: "grants-ui",
      tokenId: TOKEN_ID,
      callerTokenId: CALLER_ID,
      operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
      caller: CASE_READER_CLIENT,
    });
  });

  it("passes a refusal on with its code", async () => {
    revokeApiTokenUseCase.mockRejectedValue(
      withErrorCode(
        Boom.conflict("A request cannot revoke the token it is made with"),
        "API_TOKEN_IN_USE",
      ),
    );

    const response = await post();

    expect(response.statusCode).toBe(409);
    expect(response.result.errorCode).toBe("API_TOKEN_IN_USE");
  });

  it.each([
    ["a blank name", "%20"],
    ["an invalid name", "Grants_UI"],
  ])("leaves %s to the use case, which finds no token", async (_, name) => {
    await post(`/actuators/clients/${name}/tokens/${TOKEN_ID}/revoke`);

    expect(revokeApiTokenUseCase).toHaveBeenCalledOnce();
  });

  it("answers 400 to a token id that is not 24 hex characters", async () => {
    const response = await post(
      "/actuators/clients/grants-ui/tokens/nope/revoke",
    );

    expect(response.statusCode).toBe(400);
    expect(revokeApiTokenUseCase).not.toHaveBeenCalled();
  });
});
