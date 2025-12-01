import Joi from "joi";
import { logger } from "../../common/logger.js";
import { ValidationError } from "../schemas/common.schema.js";
import { assignUserToCaseRequestSchema } from "../schemas/requests/assign-user-to-case-request.schema.js";
import { assignUserToCaseUseCase } from "../use-cases/assign-user-to-case.use-case.js";

export const assignUserToCaseRoute = {
  method: "PATCH",
  path: "/cases/{caseId}/assigned-user",
  options: {
    description: "Assign a user to a case",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: Joi.string().hex().length(24),
      }),
      payload: assignUserToCaseRequestSchema,
    },
    response: {
      status: {
        400: ValidationError,
      },
    },
  },
  async handler(request, h) {
    const { caseId } = request.params;
    const { user } = request.auth.credentials;
    const { assignedUserId, notes } = request.payload;

    logger.info(`Assigning user ${assignedUserId} to case ${caseId}`);
    await assignUserToCaseUseCase({
      caseId,
      assignedUserId,
      notes,
      user,
    });

    logger.info(`Finished: Assigning user ${assignedUserId} to case ${caseId}`);

    return h.response().code(204);
  },
};
