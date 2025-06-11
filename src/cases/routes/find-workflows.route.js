import { ValidationError } from "../schemas/common.schema.js";
import { findWorkflowsResponseSchema } from "../schemas/responses/find-workflows-response.schema.js";
import { findWorkflowsUseCase } from "../use-cases/find-workflows.use-case.js";

export const findWorkflowsRoute = {
  method: "GET",
  path: "/workflows",
  options: {
    description: "Find workflows",
    tags: ["api"],
    response: {
      status: {
        200: findWorkflowsResponseSchema,
        400: ValidationError,
      },
    },
  },
  async handler() {
    const results = await findWorkflowsUseCase();

    return results;
  },
};
