import Joi from "joi";
import { updateUserRequestSchema } from "../schemas/requests/update-user-request.schema.js";
import { idSchema } from "../schemas/user/id.schema.js";
import { updateUserUseCase } from "../use-cases/update-user.use-case.js";

export const updateUserRoute = {
  method: "PATCH",
  path: "/users/{userId}",
  options: {
    description: "Update a user",
    tags: ["api"],
    validate: {
      params: Joi.object({
        userId: idSchema,
      }),
      payload: updateUserRequestSchema,
    },
  },
  async handler(request, h) {
    await updateUserUseCase({
      userId: request.params.userId,
      props: request.payload,
    });

    return h.response().code(204);
  },
};
