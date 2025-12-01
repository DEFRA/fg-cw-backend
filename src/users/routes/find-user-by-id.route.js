import Joi from "joi";
import { logger } from "../../common/logger.js";
import { idSchema } from "../../common/schemas/user/id.schema.js";
import { findUserResponseSchema } from "../schemas/responses/find-user-response.schema.js";
import { findUserByIdUseCase } from "../use-cases/find-user-by-id.use-case.js";

export const findUserByIdRoute = {
  method: "GET",
  path: "/users/{userId}",
  options: {
    description: "Find a user by id",
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
    logger.info(`Finding user by id: ${userId}`);
    const result = await findUserByIdUseCase(userId);
    logger.info(`Finished: Finding user by id: ${userId}`);
    return result;
  },
};
