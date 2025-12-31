import { logger } from "../../common/logger.js";
import { HttpCodes } from "../../common/schemas/http-codes.js";
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
    logger.info(`Creating user: ${request.payload.name}`);
    const { user } = request.auth.credentials;
    const createdUser = await createUserUseCase({ ...request.payload, user });
    logger.info(`Finished: Creating user: ${request.payload.name}`);
    return h.response(createdUser).code(HttpCodes.Created);
  },
};
