import Joi from "joi";
import { createPageResponse } from "../../common/create-page-response.js";
import { idSchema } from "../../common/schemas/user/id.schema.js";
import { updateUserRequestSchema } from "../schemas/requests/update-user-request.schema.js";
import { updateUserUseCase } from "../use-cases/update-user.use-case.js";

export const updateUserRoute = {
  method: "PATCH",
  path: "/admin/users/{userId}",
  options: {
    description: "Update a user (admin only)",
    tags: ["api"],
    validate: {
      params: Joi.object({
        userId: idSchema,
      }),
      payload: updateUserRequestSchema,
    },
  },
  async handler(request) {
    const { user: authenticatedUser } = request.auth.credentials;

    const data = await updateUserUseCase({
      authenticatedUser,
      userId: request.params.userId,
      props: request.payload,
    });

    return createPageResponse({ user: authenticatedUser, data });
  },
};
