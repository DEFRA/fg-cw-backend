import Joi from "joi";
import { buildCaseDetailsTabUseCase } from "../use-cases/build-case-details-tab-use-case.js";

export const findCaseByIdTabIdRoute = {
  method: "GET",
  path: "/cases/{caseId}/tabs/{tabId}",
  options: {
    description: "Find case agreements by id",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: Joi.string().hex().length(24),
        tabId: Joi.string(),
      }),
    },
    response: {
      // schema: findCaseAgreementsResponseSchema,
    },
  },
  async handler(request) {
    const { caseId, tabId } = request.params;

    const tabData = await buildCaseDetailsTabUseCase(caseId, tabId);

    console.log(JSON.stringify(tabData, null, 2));

    return tabData;
  },
};
