import { logger } from "../../common/logger.js";
import { createRoleRequestSchema } from "../schemas/requests/create-role-request.schema.js";
import { createRoleUseCase } from "../use-cases/create-role.use-case.js";

export const createRoleRoute = {
  method: "POST",
  path: "/roles",
  options: {
    description: "Create a role",
    tags: ["api"],
    validate: {
      payload: createRoleRequestSchema,
    },
  },
  async handler(request, h) {
    logger.info(`Creating role with code ${request.payload.code}`);

    const { user } = request.auth.credentials;
    const { code, description } = request.payload;
    await createRoleUseCase({ user, code, description });

    logger.info(`Finished: Creating role with code ${request.payload.code}`);
    return h.response().code(204);
  },
};
