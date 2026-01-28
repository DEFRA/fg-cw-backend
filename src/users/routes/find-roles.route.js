import { findRolesUseCase } from "../use-cases/find-roles.use-case.js";

export const findRolesRoute = {
  method: "GET",
  path: "/roles",
  options: {
    description: "Find roles",
    tags: ["api"],
  },
  async handler() {
    return await findRolesUseCase();
  },
};
