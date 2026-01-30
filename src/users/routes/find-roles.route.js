import { createPageResponse } from "../../common/create-page-response.js";
import { findRolesUseCase } from "../use-cases/find-roles.use-case.js";

export const findRolesRoute = {
  method: "GET",
  path: "/roles",
  options: {
    description: "Find roles (admin only)",
    tags: ["api"],
  },
  async handler(request) {
    const { user } = request.auth.credentials;
    const data = await findRolesUseCase({ user });
    return createPageResponse({ user, data });
  },
};
