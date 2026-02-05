import Joi from "joi";
import { createPageResponse } from "../../common/create-page-response.js";
import { findCasesUseCase } from "../use-cases/find-cases.use-case.js";

export const findCasesRoute = {
  method: "GET",
  path: "/cases",
  options: {
    description: "Find all cases",
    tags: ["api"],
    validate: {
      query: Joi.object({
        prev: Joi.string(),
        next: Joi.string(),
      }),
    },
  },
  async handler(request) {
    const { query } = request;
    const { user } = request.auth.credentials;

    const data = await findCasesUseCase({
      user,
      query,
    });

    return createPageResponse({ user, data });
  },
};
