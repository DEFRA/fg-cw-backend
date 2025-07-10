import Joi from "joi";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { ValidationError } from "../schemas/common.schema.js";
import { assignUserToCaseRequestSchema } from "../schemas/requests/assign-user-to-case-request.schema.js";
import { assignUserToCaseUseCase } from "../use-cases/assign-user-to-case.use-case.js";
import { createCaseAssignedTimelineEvent } from "../use-cases/create-case-assigned-timeline-event.use-case.js";

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
    const { assignedUserId } = request.payload;

    await assignUserToCaseUseCase({
      caseId,
      assignedUserId,
    });

    let userName = null;
    if (assignedUserId) {
      userName = (await findUserByIdUseCase(assignedUserId)).name;
    }

    await createCaseAssignedTimelineEvent({
      caseId,
      createdBy: "System", // TODO - to come from authorised user?
      data: {
        assignedTo: userName,
      },
    });

    return h.response().code(204);
  },
};
