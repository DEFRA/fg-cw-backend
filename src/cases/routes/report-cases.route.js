import Joi from "joi";
import { createPageResponse } from "../../common/create-page-response.js";
import { reportCasesUseCase } from "../use-cases/report-cases.use-case.js";

export const reportCasesRoute = {
  method: "GET",
  path: "/cases/report",
  options: {
    description: "Count of cases by lifecycle position for a case type",
    tags: ["api"],
    validate: {
      query: Joi.object({
        workflowCode: Joi.string(),
      }),
    },
  },
  async handler(request) {
    const { query } = request;
    const { user } = request.auth.credentials;

    const data = await reportCasesUseCase({ user, query });

    return createPageResponse({ user, data });
  },
};
