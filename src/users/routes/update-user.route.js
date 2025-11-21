import Joi from "joi";
import { logger } from "../../common/logger.js";
import { idSchema } from "../../common/schemas/user/id.schema.js";
import { updateUserRequestSchema } from "../schemas/requests/update-user-request.schema.js";
import { findUserResponseSchema } from "../schemas/responses/find-user-response.schema.js";
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
    response: {
      schema: findUserResponseSchema,
    },
  },
  async handler(request) {
    logger.info(`Updating user: ${request.params.userId}`);
    const user = await updateUserUseCase({
      userId: request.params.userId,
      props: request.payload,
    });
    logger.info(`User updated: ${user.name}`);
    return user;
  },
};
