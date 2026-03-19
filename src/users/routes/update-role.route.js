import Joi from "joi";
import { HttpCodes } from "../../common/schemas/http-codes.js";
import { codeSchema } from "../../common/schemas/roles/code.schema.js";
import { updateRoleRequestSchema } from "../schemas/requests/update-role-request.schema.js";
import { updateRoleUseCase } from "../use-cases/update-role.use-case.js";

export const updateRoleRoute = {
  method: "PUT",
  path: "/roles/{code}",
  options: {
    description: "Update a role",
    tags: ["api"],
    validate: {
      params: Joi.object({
        code: codeSchema,
      }),
      payload: updateRoleRequestSchema,
    },
  },
  async handler(request, h) {
    const { user } = request.auth.credentials;
    const { code } = request.params;
    const { description, assignable } = request.payload;

    await updateRoleUseCase({
      user,
      code,
      description,
      assignable,
    });

    return h.response().code(HttpCodes.NoContent);
  },
};
