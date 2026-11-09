import { operatorOf } from "../../common/actor-header.js";
import { safeResponseFailAction } from "../../common/validation.js";
import {
  apiClientFailAction,
  tokenListResponseSchema,
} from "../schemas/api-client.schema.js";
import { apiClientOperatorHeaders } from "../schemas/operator-headers.schema.js";
import { listApiClientsUseCase } from "../use-cases/list-api-clients.use-case.js";

export const listClientsRoute = {
  method: "GET",
  path: "/actuators/clients",
  options: {
    description:
      "Every access token of this service, revoked and expired ones included, each with its client (null when the row has no valid name), marked inUse when it is the token this request is made with, and with the row as stored. Never a whole hash: the stored id shows only its first and last 3 characters. Audited as VIEW_API_CLIENT.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    cache: { otherwise: "no-store" },
    validate: {
      headers: apiClientOperatorHeaders,
      failAction: apiClientFailAction,
    },
    response: {
      schema: tokenListResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return listApiClientsUseCase({
      callerTokenId: request.auth.credentials.tokenId,
      operator: operatorOf(request),
      caller: request.auth.credentials.service,
    });
  },
};
