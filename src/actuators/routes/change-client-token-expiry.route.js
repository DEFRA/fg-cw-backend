import { operatorOf } from "../../common/actor-header.js";
import { safeResponseFailAction } from "../../common/validation.js";
import {
  apiClientFailAction,
  changeExpiryPayloadSchema,
  changedExpiryResponseSchema,
  tokenParamsSchema,
} from "../schemas/api-client.schema.js";
import { apiClientOperatorHeaders } from "../schemas/operator-headers.schema.js";
import { changeApiTokenExpiryUseCase } from "../use-cases/change-api-token-expiry.use-case.js";

export const changeClientTokenExpiryRoute = {
  method: "PUT",
  path: "/actuators/clients/{clientId}/tokens/{tokenId}/expiry",
  options: {
    description:
      "Set one token's expiry to a future date up to 9999-12-31 or never, reviving it if it was revoked. Audited as CHANGE_API_TOKEN_EXPIRY. 200 with the updated token, its previous expiry and whether it was revived. 400 with errorCode API_TOKEN_INVALID_EXPIRY; 404 API_TOKEN_NOT_FOUND; 409 API_TOKEN_IN_USE for the token this request is made with given a date that has passed, API_TOKEN_NOT_ACTIVE when the row changed meanwhile.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      headers: apiClientOperatorHeaders,
      params: tokenParamsSchema,
      payload: changeExpiryPayloadSchema,
      failAction: apiClientFailAction,
    },
    response: {
      schema: changedExpiryResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    const { clientId, tokenId } = request.params;

    return changeApiTokenExpiryUseCase({
      clientId,
      tokenId,
      expiresAt: request.payload.expiresAt,
      callerTokenId: request.auth.credentials.tokenId,
      operator: operatorOf(request),
      caller: request.auth.credentials.service,
    });
  },
};
