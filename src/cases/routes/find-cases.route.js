import { createPageResponse } from "../../common/create-page-response.js";
import { findCasesUseCase } from "../use-cases/find-cases.use-case.js";

export const findCasesRoute = {
  method: "GET",
  path: "/cases",
  options: {
    description: "Find all cases",
    tags: ["api"],
  },
  async handler(request) {
    const { user } = request.auth.credentials;
    const data = await findCasesUseCase(user);
    return createPageResponse({ user, data });
  },
};
