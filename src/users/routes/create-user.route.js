import { createUserRequestSchema } from "../schemas/requests/create-user-request.schema.js";
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
  },
  async handler(request, h) {
    const user = await createUserUseCase(request.payload);

    return h
      .response({
        id: user.id,
      })
      .code(201);
  },
};
