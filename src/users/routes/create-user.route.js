import { logger } from "../../common/logger.js";
import { createUserRequestSchema } from "../schemas/requests/create-user-request.schema.js";
import { findUserResponseSchema } from "../schemas/responses/find-user-response.schema.js";
import { createUserUseCase } from "../use-cases/create-user.use-case.js";

export const createUserRoute = {
  method: "POST",
  path: "/users",
  options: {
    description: "Create a user",
    tags: ["api"],
    validate: {
      payload: createUserRequestSchema,
    },
    response: {
      schema: findUserResponseSchema,
    },
  },
  async handler(request, h) {
    logger.info("Creating user");
    const user = await createUserUseCase(request.payload);
    logger.info("Finished: Creating user");
    return h.response(user).code(201);
  },
};
