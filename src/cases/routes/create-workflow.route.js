import { logger } from "../../common/logger.js";
import { ValidationError } from "../schemas/common.schema.js";
import { workflowSchema } from "../schemas/workflow.schema.js";
import { createWorkflowUseCase } from "../use-cases/create-workflow.use-case.js";

export const createWorkflowRoute = {
  method: "POST",
  path: "/workflows",
  options: {
    description: "Create a workflow",
    tags: ["api"],
    validate: {
      payload: workflowSchema.WorkflowData,
    },
    response: {
      status: {
        400: ValidationError,
      },
    },
  },
  async handler(request, h) {
    const { user } = request.auth.credentials;
    logger.info(`Creating workflow with code ${request.payload.code}`);
    await createWorkflowUseCase({ ...request.payload, user });
    logger.info(
      `Finished: Creating workflow with code ${request.payload.code}`,
    );
    return h.response().code(204);
  },
};
