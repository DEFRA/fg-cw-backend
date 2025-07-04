import Joi from "joi";
import { codeSchema } from "../../common/schemas/roles/code.schema.js";
import { findRoleResponseSchema } from "../schemas/responses/find-role-response.schema.js";
import { findRoleByCodeUseCase } from "../use-cases/find-role-by-code.use-case.js";

export const findRoleByCodeRoute = {
  method: "GET",
  path: "/roles/{code}",
  options: {
    description: "Find a role by code",
    tags: ["api"],
    validate: {
      params: Joi.object({
        code: codeSchema,
      }),
    },
    response: {
      schema: findRoleResponseSchema,
    },
  },
  async handler(request) {
    const role = await findRoleByCodeUseCase(request.params.code);

    return role;
  },
};
