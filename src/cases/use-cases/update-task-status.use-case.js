import { updateTaskStatus } from "../repositories/case.repository.js";

export const updateTaskStatusUseCase = async (command) => {
  await updateTaskStatus({
    caseId: command.caseId,
    stageId: command.stageId,
    taskGroupId: command.taskGroupId,
    taskId: command.taskId,
    status: command.status,
  });
};
