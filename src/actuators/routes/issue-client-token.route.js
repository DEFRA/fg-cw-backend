import { operatorOf } from "../../common/actor-header.js";
import { HttpCodes } from "../../common/schemas/http-codes.js";
import { safeResponseFailAction } from "../../common/validation.js";
import {
  apiClientFailAction,
  clientParamsSchema,
  issueTokenPayloadSchema,
  issuedTokenResponseSchema,
} from "../schemas/api-client.schema.js";
import { apiClientOperatorHeaders } from "../schemas/operator-headers.schema.js";
import { issueApiTokenUseCase } from "../use-cases/issue-api-token.use-case.js";

export const issueClientTokenRoute = {
  method: "POST",
  path: "/actuators/clients/{clientId}/tokens",
  options: {
    description:
      "Issue an API client a token from its hash and hint, expiring at expiresAt (a future date up to 9999-12-31) or never; with newClient, create the client with it. Audited as ISSUE_API_TOKEN. 201 with the token. 400 with errorCode API_CLIENT_INVALID_NAME, API_TOKEN_INVALID_HASH, API_TOKEN_INVALID_HINT or API_TOKEN_INVALID_EXPIRY; 404 API_CLIENT_NOT_FOUND; 409 API_CLIENT_EXISTS or API_TOKEN_DUPLICATE.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      headers: apiClientOperatorHeaders,
      params: clientParamsSchema,
      payload: issueTokenPayloadSchema,
      failAction: apiClientFailAction,
    },
    response: {
      status: { [HttpCodes.Created]: issuedTokenResponseSchema },
      failAction: safeResponseFailAction,
    },
  },
  async handler(request, h) {
    const issued = await issueApiTokenUseCase({
      clientId: request.params.clientId,
      tokenHash: request.payload.tokenHash,
      tokenHint: request.payload.tokenHint,
      expiresAt: request.payload.expiresAt,
      newClient: request.payload.newClient,
      operator: operatorOf(request),
      caller: request.auth.credentials.service,
    });

    return h.response(issued).code(HttpCodes.Created);
  },
};
