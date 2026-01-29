import Joi from "joi";

import { adminAccessCheckUseCase } from "../use-cases/admin-access-check.use-case.js";

export const adminAccessCheckRoute = {
  method: "GET",
  path: "/admin/access-check",
  options: {
    description: "Check if user has admin access",
    tags: ["api"],
    response: {
      schema: Joi.object({
        ok: Joi.boolean().required(),
      }),
    },
  },
  async handler(request) {
    return adminAccessCheckUseCase({
      user: request.auth.credentials.user,
    });
  },
};
