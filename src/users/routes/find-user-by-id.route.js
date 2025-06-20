import Joi from "joi";
import { findUserResponseSchema } from "../schemas/responses/find-user-response.schema.js";
import { idSchema } from "../schemas/user/id.schema.js";
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

    const result = await findUserByIdUseCase(userId);

    return result;
  },
};
