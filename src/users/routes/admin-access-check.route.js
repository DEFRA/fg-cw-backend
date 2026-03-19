import { createPageResponse } from "../../common/create-page-response.js";
import { adminAccessCheckUseCase } from "../use-cases/admin-access-check.use-case.js";

export const adminAccessCheckRoute = {
  method: "GET",
  path: "/admin/access-check",
  options: {
    description: "Check if user has admin access",
    tags: ["api"],
  },
  async handler(request) {
    const { user } = request.auth.credentials;
    const data = adminAccessCheckUseCase({ user });
    return createPageResponse({ user, data });
  },
};
