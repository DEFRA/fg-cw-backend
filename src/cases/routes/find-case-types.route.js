import { viewCaseTypeListUseCase } from "../use-cases/view-case-type-list.use-case.js";

export const findCaseTypesRoute = {
  method: "GET",
  path: "/case-types",
  options: {
    description: "Find all case types (admin only)",
    tags: ["api"],
  },
  async handler(request) {
    const { user } = request.auth.credentials;

    return viewCaseTypeListUseCase({ user });
  },
};
