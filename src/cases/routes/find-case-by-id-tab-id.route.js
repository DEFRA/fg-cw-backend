import Joi from "joi";
import { createPageResponse } from "../../common/create-page-response.js";
import { buildCaseDetailsTabUseCase } from "../use-cases/build-case-details-tab.use-case.js";

export const findCaseByIdTabIdRoute = {
  method: "GET",
  path: "/cases/{caseId}/tabs/{tabId}",
  options: {
    description: "Find case details by tab id",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: Joi.string().hex().length(24),
        tabId: Joi.string(),
      }),
      query: Joi.object().unknown(true).options({ stripUnknown: false }),
    },
  },
  async handler(request) {
    const { caseId, tabId } = request.params;
    const query = request.query ?? {};
    const { user } = request.auth.credentials;

    const data = await buildCaseDetailsTabUseCase({
      params: { caseId, tabId },
      query,
      user,
    });

    return createPageResponse({ user, data });
  },
};
