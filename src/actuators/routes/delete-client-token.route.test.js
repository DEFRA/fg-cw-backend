import Boom from "@hapi/boom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { withErrorCode } from "../../common/with-error-code.js";
import { deleteApiTokenUseCase } from "../use-cases/delete-api-token.use-case.js";
import { deleteClientTokenRoute } from "./delete-client-token.route.js";

vi.mock("../use-cases/delete-api-token.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const TOKEN_ID = "6650c1f2a9e4b1d07c20bd91";

const del = async (name = "grants-ui", tokenId = TOKEN_ID) =>
  (await serverFor(deleteClientTokenRoute)).inject({
    method: "DELETE",
    url: `/actuators/clients/${name}/tokens/${tokenId}`,
    headers: asGas(),
  });

beforeEach(() => {
  deleteApiTokenUseCase.mockResolvedValue();
});

describe("deleteClientTokenRoute", () => {
  it("is a public API DELETE on the token", () => {
    expect(deleteClientTokenRoute.method).toBe("DELETE");
    expect(deleteClientTokenRoute.path).toBe(
      "/actuators/clients/{clientId}/tokens/{tokenId}",
    );
    expect(deleteClientTokenRoute.options.auth).toBe("public-api");
  });

  it("answers 204 with no body, passing the address and the operator", async () => {
    const response = await del();

    expect(response.statusCode).toBe(204);
    expect(response.payload).toBe("");
    expect(deleteApiTokenUseCase).toHaveBeenCalledWith({
      clientId: "grants-ui",
      tokenId: TOKEN_ID,
      operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
      caller: CASE_READER_CLIENT,
    });
  });

  it("passes a refusal on with its code", async () => {
    deleteApiTokenUseCase.mockRejectedValue(
      withErrorCode(Boom.conflict("active"), "API_TOKEN_ACTIVE"),
    );

    const response = await del();

    expect(response.statusCode).toBe(409);
    expect(response.result.errorCode).toBe("API_TOKEN_ACTIVE");
  });

  it("leaves a name that fails the rule to the use case", async () => {
    await del("Grants_UI");

    expect(deleteApiTokenUseCase.mock.calls[0][0].clientId).toBe("Grants_UI");
  });

  it("answers 400 to a token id that is not 24 hex characters", async () => {
    expect((await del("grants-ui", "nope")).statusCode).toBe(400);
  });
});
