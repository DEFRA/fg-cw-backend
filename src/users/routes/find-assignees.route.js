import Joi from "joi";

import { findAssigneesResponseSchema } from "../schemas/responses/find-assignees-response.schema.js";
import { findAssigneesUseCase } from "../use-cases/find-assignees.use-case.js";

export const findAssigneesRoute = {
  method: "GET",
  path: "/users/assignees",
  options: {
    description: "Find assignable users",
    tags: ["api"],
    validate: {
      query: Joi.object({
        allAppRoles: Joi.array().items(Joi.string()).single().default([]),
        anyAppRoles: Joi.array().items(Joi.string()).single().default([]),
      }).options({
        allowUnknown: true,
        stripUnknown: true,
      }),
    },
    response: {
      schema: findAssigneesResponseSchema,
    },
  },
  async handler(request) {
    return await findAssigneesUseCase({
      allAppRoles: request.query.allAppRoles,
      anyAppRoles: request.query.anyAppRoles,
    });
  },
};
