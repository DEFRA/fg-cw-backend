import { logoutUserRequestSchema } from "../schemas/requests/logout-user-request.schema.js";
import { logoutUserUseCase } from "../use-cases/logout-user.use-case.js";

const NO_CONTENT_STATUS_CODE = 204;

export const logoutUserRoute = {
  method: "POST",
  path: "/users/logout",
  options: {
    description: "Record a user logout audit event",
    tags: ["api"],
    validate: {
      payload: logoutUserRequestSchema,
    },
  },
  async handler(request, h) {
    await logoutUserUseCase(request.payload);
    return h.response().code(NO_CONTENT_STATUS_CODE);
  },
};
