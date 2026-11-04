import { operatorOf } from "../../common/actor-header.js";
import { HttpCodes } from "../../common/schemas/http-codes.js";
import { safeResponseFailAction } from "../../common/validation.js";
import {
  apiClientFailAction,
  rotatedTokenResponseSchema,
  rotateTokenPayloadSchema,
  tokenParamsSchema,
} from "../schemas/api-client.schema.js";
import { apiClientOperatorHeaders } from "../schemas/operator-headers.schema.js";
import { rotateApiTokenUseCase } from "../use-cases/rotate-api-token.use-case.js";

export const rotateClientTokenRoute = {
  method: "POST",
  path: "/actuators/clients/{clientId}/tokens/{tokenId}/rotate",
  options: {
    description:
      "Replace one active token with a new one from its hash and hint, with the old token's expiry, keeping the old one working for keepOld: none, or 24h or 7d and then to 23:59:59 UK time that day. Audited as ROTATE_API_TOKEN. 201 with the new token and the old token's new expiry. 400 with errorCode API_TOKEN_INVALID_HASH or API_TOKEN_INVALID_HINT; 404 API_TOKEN_NOT_FOUND; 409 API_TOKEN_NOT_ACTIVE, API_TOKEN_IN_USE for the token this request is made with and no overlap, or API_TOKEN_DUPLICATE.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      headers: apiClientOperatorHeaders,
      params: tokenParamsSchema,
      payload: rotateTokenPayloadSchema,
      failAction: apiClientFailAction,
    },
    response: {
      status: { [HttpCodes.Created]: rotatedTokenResponseSchema },
      failAction: safeResponseFailAction,
    },
  },
  async handler(request, h) {
    const { clientId, tokenId } = request.params;
    const rotated = await rotateApiTokenUseCase({
      clientId,
      tokenId,
      ...request.payload,
      callerTokenId: request.auth.credentials.tokenId,
      operator: operatorOf(request),
      caller: request.auth.credentials.service,
    });

    return h.response(rotated).code(HttpCodes.Created);
  },
};
