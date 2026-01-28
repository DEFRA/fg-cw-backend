import { findRolesResponseSchema } from "../schemas/responses/find-roles-response.schema.js";
import { findRolesUseCase } from "../use-cases/find-roles.use-case.js";

export const findRolesRoute = {
  method: "GET",
  path: "/roles",
  options: {
    description: "Find roles (admin only)",
    tags: ["api"],
    response: {
      schema: findRolesResponseSchema,
    },
  },
  async handler(request) {
    return await findRolesUseCase({
      user: request.auth.credentials.user,
    });
  },
};
