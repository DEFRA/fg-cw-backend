import Joi from "joi";
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
      }),
    },
    response: {
      schema: findUsersResponseSchema,
    },
  },
  async handler(request) {
    const results = await findUsersUseCase({
      idpId: request.query.idpId,
    });

    return results;
  },
};
