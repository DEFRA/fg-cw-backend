import Joi from "joi";

import { createPageResponse } from "../../common/create-page-response.js";
import { idSchema } from "../../common/schemas/user/id.schema.js";
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
  },
  async handler(request) {
    const { user } = request.auth.credentials;
    const { userId } = request.params;

    const data = await adminFindUserByIdUseCase({ user, userId });

    return createPageResponse({ user, data });
  },
};
