import Joi from "joi";
import { findSecretWorkflowUseCase } from "../use-cases/find-secret-workflow.use-case.js";
import { getAuthenticatedUserUseCase } from "../use-cases/get-authenticated-user-use.case.js";

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
    const { idpId } = request.auth.credentials;

    const user = await getAuthenticatedUserUseCase(idpId);

    const { workflowCode } = request.params;

    const result = await findSecretWorkflowUseCase(workflowCode, user);

    return result;
  },
};
