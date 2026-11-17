import Joi from "joi";
import { viewCaseListByTypeUseCase } from "../use-cases/view-case-list-by-type.use-case.js";

export const findCasesByTypeRoute = {
  method: "GET",
  path: "/types/{caseType}/cases",
  options: {
    description: "Find cases filtered by case type",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseType: Joi.string().trim().max(100).required(),
      }),
      // Mirrors the existing GET /cases query schema (find-cases.route.js).
      // These are not new features — they are the existing case list defaults
      // for pagination (cursor/direction) and sorting. The ticket's out-of-scope
      // items refer to new pagination/sorting/filter designs, not the existing ones.
      query: Joi.object({
        search: Joi.string().allow(""),
        cursor: Joi.string(),
        direction: Joi.string().valid("forward", "backward").default("forward"),
        caseRef: Joi.string().valid("asc", "desc"),
        workflowCode: Joi.string().valid("asc", "desc"),
        createdAt: Joi.string().valid("asc", "desc"),
      }),
    },
  },
  async handler(request) {
    const { caseType } = request.params;
    const { query } = request;
    const { user } = request.auth.credentials;

    return viewCaseListByTypeUseCase({
      user,
      query: { ...query, caseType },
    });
  },
};
