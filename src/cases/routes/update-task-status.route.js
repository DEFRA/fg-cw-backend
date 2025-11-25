import Joi from "joi";
import { logger } from "../../common/logger.js";
import { ValidationError } from "../schemas/common.schema.js";
import { updateTaskStatusRequestSchema } from "../schemas/requests/update-task-status-request.schema.js";
import { Code } from "../schemas/task.schema.js";
import { updateTaskStatusUseCase } from "../use-cases/update-task-status.use-case.js";

export const updateTaskStatusRoute = {
  method: "PATCH",
  path: "/cases/{caseId}/task-groups/{taskGroupCode}/tasks/{taskCode}/status",
  options: {
    description: "Update status of a task",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: Joi.string().hex().length(24),
        taskGroupCode: Code,
        taskCode: Code,
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
    const { caseId, taskGroupCode, taskCode } = request.params;
    const { status, completed, comment } = request.payload;
    const { user } = request.auth.credentials;

    logger.info(`Updating status of task ${taskCode} in case ${caseId}`);

    await updateTaskStatusUseCase({
      caseId,
      taskCode,
      taskGroupCode,
      status,
      completed,
      comment,
      user,
    });

    logger.info(
      `Finished updating status of task ${taskCode} in case ${caseId}`,
    );

    return h.response().code(204);
  },
};
