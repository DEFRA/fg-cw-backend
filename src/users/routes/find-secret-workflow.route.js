import Joi from "joi";
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
    return await findSecretWorkflowUseCase({
      workflowCode: request.params.workflowCode,
      user: request.auth.credentials.user,
    });
  },
};
