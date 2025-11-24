import Joi from "joi";
import { logger } from "../../common/logger.js";
import { findCaseByIdTabIdResponseSchema } from "../schemas/responses/find-case-by-id-tab-id-response.schema.js";
import { buildCaseDetailsTabUseCase } from "../use-cases/build-case-details-tab.use-case.js";

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
      query: Joi.object().unknown(true).options({ stripUnknown: false }),
    },
    response: {
      schema: findCaseByIdTabIdResponseSchema,
    },
  },
  async handler(request) {
    const { caseId, tabId } = request.params;
    const query = request.query ?? {};

    logger.debug(
      `Finding case agreements for case ${caseId} using query ${JSON.stringify(query)}`,
    );
    const tabData = await buildCaseDetailsTabUseCase({
      params: { caseId, tabId },
      query,
    });

    return tabData;
  },
};
