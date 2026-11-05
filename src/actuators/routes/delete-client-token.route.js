import { operatorOf } from "../../common/actor-header.js";
import { HttpCodes } from "../../common/schemas/http-codes.js";
import {
  apiClientFailAction,
  tokenParamsSchema,
} from "../schemas/api-client.schema.js";
import { apiClientOperatorHeaders } from "../schemas/operator-headers.schema.js";
import { deleteApiTokenUseCase } from "../use-cases/delete-api-token.use-case.js";

export const deleteClientTokenRoute = {
  method: "DELETE",
  path: "/actuators/clients/{clientId}/tokens/{tokenId}",
  options: {
    description:
      "Delete one token that is not active, for good; a client's last token going frees its name. Audited as DELETE_API_TOKEN. 204 with no body. 404 with errorCode API_TOKEN_NOT_FOUND, also for a name that fails the name rule; 409 API_TOKEN_ACTIVE.",
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

    await deleteApiTokenUseCase({
      clientId,
      tokenId,
      operator: operatorOf(request),
      caller: request.auth.credentials.service,
    });

    return h.response().code(HttpCodes.NoContent);
  },
};
