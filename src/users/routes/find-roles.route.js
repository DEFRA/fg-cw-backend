import { viewRoleListUseCase } from "../use-cases/view-role-list.use-case.js";

export const findRolesRoute = {
  method: "GET",
  path: "/roles",
  options: {
    description: "Find roles (admin only)",
    tags: ["api"],
  },
  async handler(request) {
    const { user } = request.auth.credentials;

    return viewRoleListUseCase({ user });
  },
};
