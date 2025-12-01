import Joi from "joi";
import { logger } from "../../common/logger.js";
import { findCaseByIdUseCase } from "../use-cases/find-case-by-id.use-case.js";

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

    logger.info(`Finding case ${caseId}`);
    const result = await findCaseByIdUseCase(caseId, user, {
      params: { caseId, tabId },
    });

    logger.info(`Finished: Finding case ${caseId}`);
    return result;
  },
};
