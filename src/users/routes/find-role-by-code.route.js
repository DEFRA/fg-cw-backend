import Joi from "joi";
import { createPageResponse } from "../../common/create-page-response.js";
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
    const { user } = request.auth.credentials;
    const { code } = request.params;
    const data = await findRoleByCodeUseCase({
      user,
      code,
    });
    return createPageResponse({ user, data });
  },
};
