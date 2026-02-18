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
        cursor: Joi.string(),
        direction: Joi.string().valid("forward", "backward").default("forward"),
        caseRef: Joi.string().valid("asc", "desc"),
        createdAt: Joi.string().valid("asc", "desc"),
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
