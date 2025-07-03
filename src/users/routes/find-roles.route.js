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
    const roles = await findRolesUseCase();

    return roles;
  },
};
