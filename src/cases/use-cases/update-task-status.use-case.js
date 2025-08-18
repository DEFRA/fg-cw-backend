import { getAuthenticatedUser } from "../../common/auth.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { updateTaskStatus } from "../repositories/case.repository.js";

export const updateTaskStatusUseCase = async (command) => {
  const authUser = getAuthenticatedUser();
  const { caseId, stageId, taskGroupId, taskId, status } = command;

  await updateTaskStatus({
    caseId,
    stageId,
    taskGroupId,
    taskId,
    status,
    timelineEvent:
      command.status === "complete" &&
      TimelineEvent.createTaskCompleted({
        data: {
          caseId,
          stageId,
          taskGroupId,
          taskId,
        },
        createdBy: authUser.id,
      }),
  });
};
