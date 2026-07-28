import { viewLandingPageUseCase } from "../use-cases/view-landing-page.use-case.js";

export const adminAccessCheckRoute = {
  method: "GET",
  path: "/admin/access-check",
  options: {
    description: "Check if user has admin access",
    tags: ["api"],
  },
  async handler(request) {
    const { user } = request.auth.credentials;

    return viewLandingPageUseCase({ user });
  },
};
