import Joi from "joi";
import { codeSchema } from "../../common/schemas/roles/code.schema.js";
import { findUsersResponseSchema } from "../schemas/responses/find-users-response.schema.js";
import { idpIdSchema } from "../schemas/user/idp-id.schema.js";
import { findUsersUseCase } from "../use-cases/find-users.use-case.js";

export const findUsersRoute = {
  method: "GET",
  path: "/users",
  options: {
    description: "Find all users",
    tags: ["api"],
    validate: {
      query: Joi.object({
        idpId: idpIdSchema,
        allAppRoles: Joi.array().items(codeSchema).single().default([]),
        anyAppRoles: Joi.array().items(codeSchema).single().default([]),
      }),
    },
    response: {
      schema: findUsersResponseSchema,
    },
  },
  async handler(request) {
    const results = await findUsersUseCase({
      idpId: request.query.idpId,
      allAppRoles: request.query.allAppRoles,
      anyAppRoles: request.query.anyAppRoles,
    });

    return results;
  },
};
