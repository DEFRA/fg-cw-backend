import Joi from "joi";
import { codeSchema } from "../../common/schemas/roles/code.schema.js";
import { viewRoleUseCase } from "../use-cases/view-role.use-case.js";

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

    return viewRoleUseCase({ user, code });
  },
};
