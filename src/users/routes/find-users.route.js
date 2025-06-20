import { findUsersResponseSchema } from "../schemas/responses/find-users-response.schema.js";
import { findUsersUseCase } from "../use-cases/find-users.use-case.js";

export const findUsersRoute = {
  method: "GET",
  path: "/users",
  options: {
    description: "Find all users",
    tags: ["api"],
    response: {
      schema: findUsersResponseSchema,
    },
  },
  async handler() {
    const results = await findUsersUseCase();

    return results;
  },
};
