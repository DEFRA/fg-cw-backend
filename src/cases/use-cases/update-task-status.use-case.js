import { EventEnums } from "../models/event-enums.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { updateTaskStatus } from "../repositories/case.repository.js";
import { findUserAssignedToCase } from "./find-case-by-id.use-case.js";

const createTaskTimelineEvent = (
  caseId,
  stageId,
  taskGroupId,
  taskId,
  type,
  assignedUser,
) => {
  return new TimelineEvent({
    eventType: type,
    createdBy: assignedUser, // user who completed the task
    description:
      EventEnums.eventDescriptions[EventEnums.eventTypes.TASK_COMPLETED],
    data: {
      caseId,
      stageId,
      taskGroupId,
      taskId,
    },
  });
};

export const updateTaskStatusUseCase = async (command) => {
  const assignedUser = findUserAssignedToCase();

  await updateTaskStatus({
    caseId: command.caseId,
    stageId: command.stageId,
    taskGroupId: command.taskGroupId,
    taskId: command.taskId,
    status: command.status,
    timelineEvent:
      command.status === "complete" &&
      createTaskTimelineEvent(
        command.caseId,
        command.stageId,
        command.taskGroupId,
        command.taskId,
        EventEnums.eventTypes.TASK_COMPLETED,
        assignedUser,
      ),
  });
};
