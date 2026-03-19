import { loginUserRequestSchema } from "../schemas/requests/login-user-request.schema.js";
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
  },
  async handler(request, h) {
    const user = await loginUserUseCase(request.payload);
    return h.response(user);
  },
};
