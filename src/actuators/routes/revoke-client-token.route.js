import { operatorOf } from "../../common/actor-header.js";
import { HttpCodes } from "../../common/schemas/http-codes.js";
import {
  apiClientFailAction,
  tokenParamsSchema,
} from "../schemas/api-client.schema.js";
import { apiClientOperatorHeaders } from "../schemas/operator-headers.schema.js";
import { revokeApiTokenUseCase } from "../use-cases/revoke-api-token.use-case.js";

export const revokeClientTokenRoute = {
  method: "POST",
  path: "/actuators/clients/{clientId}/tokens/{tokenId}/revoke",
  options: {
    description:
      "Revoke one token of one API client: it stops working on the next request. Audited as REVOKE_API_TOKEN. 204 with no body. 404 with errorCode API_TOKEN_NOT_FOUND, also for a name that fails the name rule; 409 API_TOKEN_IN_USE for the token this request is made with, API_TOKEN_NOT_ACTIVE for one already revoked or expired.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      headers: apiClientOperatorHeaders,
      params: tokenParamsSchema,
      failAction: apiClientFailAction,
    },
  },
  async handler(request, h) {
    const { clientId, tokenId } = request.params;

    await revokeApiTokenUseCase({
      clientId,
      tokenId,
      callerTokenId: request.auth.credentials.tokenId,
      operator: operatorOf(request),
      caller: request.auth.credentials.service,
    });

    return h.response().code(HttpCodes.NoContent);
  },
};
