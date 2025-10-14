import Boom from "@hapi/boom";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const validatePayloadComment = (comment, required) => {
  if (required && !comment) {
    throw Boom.badRequest("Comment is required");
  }
};

export const updateTaskStatusUseCase = async (command) => {
  const { caseId, stageCode, taskGroupId, taskId, status, comment, user } = command;

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  // get workflow->task to validate comment
  const workflow = await findByCode(kase.workflowCode);
  const task = workflow.findTask(stageCode, taskGroupId, taskId);

  validatePayloadComment(comment, task.comment?.type === "REQUIRED");

  const updatedBy = user.id;
  kase.setTaskStatus({
    stageCode,
    taskGroupId,
    taskId,
    status,
    comment,
    updatedBy,
  });

  return update(kase);
};
