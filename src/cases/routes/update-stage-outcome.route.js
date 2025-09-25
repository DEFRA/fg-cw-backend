import Joi from "joi";
import { HttpCodes } from "../../common/schemas/http-codes.js";
import { ValidationError } from "../schemas/common.schema.js";
import { updateStageOutcomeRequestSchema } from "../schemas/requests/update-stage-outcome-request.schema.js";
import { updateStageOutcomeUseCase } from "../use-cases/update-stage-outcome.use-case.js";

export const updateStageOutcomeRoute = {
  method: "PATCH",
  path: "/cases/{caseId}/stage/outcome",
  options: {
    description: "Update case stage outcome",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: Joi.string().hex().length(24),
      }),
      payload: updateStageOutcomeRequestSchema,
    },
    response: {
      status: {
        [HttpCodes.BadRequest]: ValidationError,
      },
    },
  },
  async handler(request, h) {
    const { caseId } = request.params;
    const { actionId, comment } = request.payload;

    await updateStageOutcomeUseCase({
      caseId,
      actionId,
      comment,
    });

    return h.response().code(HttpCodes.NoContent);
  },
};
