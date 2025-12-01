import Joi from "joi";
import { logger } from "../../common/logger.js";
import { findSecretWorkflowUseCase } from "../use-cases/find-secret-workflow.use-case.js";

export const findSecretWorkflowRoute = {
  method: "GET",
  path: "/secret/workflow/{workflowCode}",
  options: {
    description: "Find workflow with user permission validation",
    tags: ["api", "secret"],
    auth: { mode: "required", strategy: "entra" },
    validate: {
      params: Joi.object({
        workflowCode: Joi.string().required(),
      }),
    },
  },
  async handler(request) {
    logger.info("Finding secret workflow");
    return await findSecretWorkflowUseCase({
      workflowCode: request.params.workflowCode,
      user: request.auth.credentials.user,
    });
  },
};
