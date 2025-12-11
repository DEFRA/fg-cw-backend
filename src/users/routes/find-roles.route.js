import { logger } from "../../common/logger.js";
import { findRolesResponseSchema } from "../schemas/responses/find-roles-response.schema.js";
import { findRolesUseCase } from "../use-cases/find-roles.use-case.js";

export const findRolesRoute = {
  method: "GET",
  path: "/roles",
  options: {
    description: "Find roles",
    tags: ["api"],
    response: {
      schema: findRolesResponseSchema,
    },
  },
  async handler() {
    logger.info("Finding all roles");
    const roles = await findRolesUseCase();
    logger.info("Finished: Finding all roles");
    return roles;
  },
};
