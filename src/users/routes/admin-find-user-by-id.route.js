import Joi from "joi";

import { idSchema } from "../../common/schemas/user/id.schema.js";
import { findUserResponseSchema } from "../schemas/responses/find-user-response.schema.js";
import { adminFindUserByIdUseCase } from "../use-cases/admin-find-user-by-id.use-case.js";

export const adminFindUserByIdRoute = {
  method: "GET",
  path: "/admin/users/{userId}",
  options: {
    description: "Find a user by id (admin only)",
    tags: ["api"],
    validate: {
      params: Joi.object({
        userId: idSchema,
      }),
    },
    response: {
      schema: findUserResponseSchema,
    },
  },
  async handler(request) {
    const { userId } = request.params;

    return await adminFindUserByIdUseCase({
      user: request.auth.credentials.user,
      userId,
    });
  },
};
