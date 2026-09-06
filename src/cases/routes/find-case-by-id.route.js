import Joi from "joi";
import { viewCaseUseCase } from "../use-cases/view-case.use-case.js";

export const findCaseByIdRoute = {
  method: "GET",
  path: "/cases/{caseId}",
  options: {
    description: "Find a case by id",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: Joi.string().hex().length(24),
      }),
    },
  },
  async handler(request) {
    const { caseId } = request.params;
    const tabId = request.query.tabId;
    const { user } = request.auth.credentials;

    return viewCaseUseCase({ caseId, tabId, user });
  },
};
