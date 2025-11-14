import { ValidationError } from "../schemas/common.schema.js";
import { findWorkflowsUseCase } from "../use-cases/find-workflows.use-case.js";

export const findWorkflowsRoute = {
  method: "GET",
  path: "/workflows",
  options: {
    description: "Find workflows",
    tags: ["api"],
    response: {
      status: {
        400: ValidationError,
      },
    },
  },
  async handler() {
    const results = await findWorkflowsUseCase();
    return results;
  },
};
