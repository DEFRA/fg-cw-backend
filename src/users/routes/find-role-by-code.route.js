import Joi from "joi";
import { codeSchema } from "../../common/schemas/roles/code.schema.js";
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
  },
  async handler(request) {
    return await findRoleByCodeUseCase(request.params.code);
  },
};
