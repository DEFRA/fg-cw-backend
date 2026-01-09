import Joi from "joi";
import { ValidationError } from "../schemas/common.schema.js";
import { UrlSafeId } from "../schemas/url-safe-id.schema.js";
import { findWorkflowByCodeUseCase } from "../use-cases/find-workflow-by-code.use-case.js";

export const findWorkflowByCodeRoute = {
  method: "GET",
  path: "/workflows/{code}",
  options: {
    description: "Find a workflow by code",
    tags: ["api"],
    validate: {
      params: Joi.object({
        code: UrlSafeId.required(),
      }),
    },
    response: {
      status: {
        400: ValidationError,
      },
    },
  },
  async handler(request) {
    const { code } = request.params;
    return await findWorkflowByCodeUseCase(code);
  },
};
