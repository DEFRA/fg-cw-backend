import Joi from "joi";
import { ValidationError } from "../schemas/common.schema.js";
import { changeCaseStageUseCase } from "../use-cases/change-case-stage.use-case.js";

export const changeCaseStageRoute = {
  method: "POST",
  path: "/cases/{caseId}/stage",
  options: {
    description: "Move case to the next stage",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: Joi.string().hex().length(24),
      }),
    },
    response: {
      status: {
        400: ValidationError,
      },
    },
  },
  async handler(request, h) {
    const { caseId } = request.params;

    await changeCaseStageUseCase(caseId);

    return h.response().code(204);
  },
};
