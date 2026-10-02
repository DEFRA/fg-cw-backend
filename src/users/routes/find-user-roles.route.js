import Joi from "joi";
import { userRolesResponseSchema } from "../schemas/responses/user-roles-response.schema.js";
import { idpIdSchema } from "../schemas/user/idp-id.schema.js";
import { findUserRolesUseCase } from "../use-cases/find-user-roles.use-case.js";

const unauthorized = 401;

// Callers must get a bare 401, so Boom's JSON envelope is discarded. The
// WWW-Authenticate challenge is kept so the response stays a valid 401.
const stripUnauthorizedBody = (request, h) => {
  const { response } = request;

  if (!response.isBoom || response.output.statusCode !== unauthorized) {
    return h.continue;
  }

  const stripped = h.response().code(unauthorized);
  const challenge = response.output.headers["WWW-Authenticate"];

  if (challenge) {
    stripped.header("WWW-Authenticate", challenge);
  }

  return stripped.takeover();
};

export const findUserRolesRoute = {
  method: "GET",
  path: "/api/users/{entraId}/roles",
  options: {
    description: "Find a user's active app roles",
    notes:
      "For calling systems outside caseworking. Returns an empty list for an unknown user or one with no active roles.",
    // The server default is the Entra strategy, so omitting this would put the
    // route behind caseworker SSO. Named rather than imported because routes
    // may not reach into server plugins; index.test.js pins it to the constant.
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    ext: {
      onPreResponse: [{ method: stripUnauthorizedBody }],
    },
    validate: {
      params: Joi.object({
        entraId: idpIdSchema.required(),
      }),
    },
    response: {
      schema: userRolesResponseSchema,
      failAction: "log",
    },
  },
  handler(request) {
    return findUserRolesUseCase({ entraId: request.params.entraId });
  },
};
