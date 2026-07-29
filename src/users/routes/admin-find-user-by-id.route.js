import Joi from "joi";

import { idSchema } from "../../common/schemas/user/id.schema.js";
import { adminViewUserDetailsUseCase } from "../use-cases/admin-view-user-details.use-case.js";

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

    return adminViewUserDetailsUseCase({ user, userId });
  },
};
