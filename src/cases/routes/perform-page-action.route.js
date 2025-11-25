import Joi from "joi";
import { HttpCodes } from "../../common/schemas/http-codes.js";
import { ValidationError } from "../schemas/common.schema.js";
import { performPageActionRequestSchema } from "../schemas/requests/perform-page-action-request.schema.js";
import { performPageActionUseCase } from "../use-cases/perform-page-action.use-case.js";

export const performPageActionRoute = {
  method: "POST",
  path: "/cases/{caseId}/page-action",
  options: {
    description: "Perform a page action for a case",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: Joi.string().hex().length(24),
      }),
      payload: performPageActionRequestSchema,
    },
    response: {
      status: {
        400: ValidationError,
      },
    },
  },
  async handler(request, h) {
    const { caseId } = request.params;
    const { actionCode } = request.payload;

    await performPageActionUseCase({
      caseId,
      actionCode,
    });

    return h.response().code(HttpCodes.NoContent);
  },
};
