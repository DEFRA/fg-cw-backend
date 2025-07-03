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
    await createRoleUseCase(request.payload);

    return h.response().code(204);
  },
};
