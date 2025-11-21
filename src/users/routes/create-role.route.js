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
    logger.info("Creating user role");
    await createRoleUseCase(request.payload);
    logger.info("User role created");
    return h.response().code(204);
  },
};
