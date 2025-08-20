import Boom from "@hapi/boom";
import { findById, update } from "../repositories/case.repository.js";

export const updateTaskStatusUseCase = async (command) => {
  const { caseId, stageId, taskGroupId, taskId, status, comment } = command;

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  kase.updateTaskStatus(stageId, taskGroupId, taskId, status, comment);

  return update(kase);
};
