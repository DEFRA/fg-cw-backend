import Boom from "@hapi/boom";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const validatePayloadComment = (comment, required) => {
  if (required && !comment) {
    throw Boom.badRequest("Comment is required");
  }
};

export const updateTaskStatusUseCase = async (command) => {
  const {
    caseId,
    phaseCode,
    stageCode,
    taskGroupCode,
    taskCode,
    status,
    comment,
    user,
  } = command;

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const workflow = await findByCode(kase.workflowCode);
  const task = workflow.findTask({
    phaseCode,
    stageCode,
    taskGroupCode,
    taskCode,
  });

  validatePayloadComment(comment, task.comment?.type === "REQUIRED");

  kase.setTaskStatus({
    phaseCode,
    stageCode,
    taskGroupCode,
    taskCode,
    status,
    comment,
    updatedBy: user.id,
  });

  return update(kase);
};
