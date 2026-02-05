import { createPageResponse } from "../../common/create-page-response.js";
import { createUserRequestSchema } from "../schemas/requests/create-user-request.schema.js";
import { adminCreateUserUseCase } from "../use-cases/admin-create-user.use-case.js";

export const adminCreateUserRoute = {
  method: "POST",
  path: "/admin/users",
  options: {
    description: "Create a new user (admin only)",
    tags: ["api"],
    validate: {
      payload: createUserRequestSchema,
    },
  },
  async handler(request) {
    const { user } = request.auth.credentials;

    const data = await adminCreateUserUseCase({
      user,
      props: request.payload,
    });

    return createPageResponse({ user, data });
  },
};
