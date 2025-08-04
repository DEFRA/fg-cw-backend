import Joi from "joi";
import { userRoleSchema } from "../../common/schemas/roles/user.role.schema.js";
import { idSchema } from "../../common/schemas/user/id.schema.js";
import { findUserResponseSchema } from "../schemas/responses/find-user-response.schema.js";
import { updateUserRoleUseCase } from "../use-cases/update-user-role.use-case.js";

export const updateUserRoleRoute = {
  method: "PATCH",
  path: "/users/{userId}/roles",
  options: {
    description: "Update user's roles",
    tags: ["api"],
    validate: {
      params: Joi.object({
        userId: idSchema,
      }),
      payload: userRoleSchema,
    },
    response: {
      schema: findUserResponseSchema,
    },
  },
  async handler(request) {
    return await updateUserRoleUseCase({
      userId: request.params.userId,
      props: request.payload,
    });
  },
};
