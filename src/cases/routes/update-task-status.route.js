import Joi from "joi";
import { ValidationError } from "../schemas/common.schema.js";
import { updateTaskStatusRequestSchema } from "../schemas/requests/update-task-status-request.schema.js";
import { UrlSafeId } from "../schemas/url-safe-id.schema.js";
import { updateTaskStatusUseCase } from "../use-cases/update-task-status.use-case.js";

export const updateTaskStatusRoute = {
  method: "PATCH",
  path: "/cases/{caseId}/stages/{stageCode}/task-groups/{taskGroupCode}/tasks/{taskCode}/status",
  options: {
    description: "Update status of a task",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: Joi.string().hex().length(24),
        stageCode: UrlSafeId,
        taskGroupCode: UrlSafeId,
        taskCode: UrlSafeId,
      }),
      payload: updateTaskStatusRequestSchema,
    },
    response: {
      status: {
        400: ValidationError,
      },
    },
  },
  async handler(request, h) {
    const { caseId, stageCode, taskGroupCode, taskCode } = request.params;
    const { status, comment } = request.payload;
    const { user } = request.auth.credentials;

    await updateTaskStatusUseCase({
      caseId,
      stageCode,
      taskCode,
      taskGroupCode,
      status,
      comment,
      user,
    });

    return h.response().code(204);
  },
};
