import { loginUserRequestSchema } from "../schemas/requests/login-user-request.schema.js";
import { findUserResponseSchema } from "../schemas/responses/find-user-response.schema.js";
import { loginUserUseCase } from "../use-cases/login-user.use-case.js";

export const loginUserRoute = {
  method: "POST",
  path: "/users/login",
  options: {
    description: "Create or update user and record login timestamp",
    tags: ["api"],
    validate: {
      payload: loginUserRequestSchema,
    },
    response: {
      schema: findUserResponseSchema,
    },
  },
  async handler(request, h) {
    const user = await loginUserUseCase(request.payload);
    return h.response(user).code(200);
  },
};
