import { EventEnums } from "./event-enums.js";
import { isTaskEvent } from "./timeline-event-context.js";

const storedDescription = (event) =>
  event.description || EventEnums.eventDescriptions[event.eventType];

const taskDescription = (eventType, context) => {
  if (context.isInput) {
    return `Task '${context.taskName}'`;
  }
  const suffix =
    eventType === EventEnums.eventTypes.TASK_COMPLETED
      ? "completed"
      : "updated";
  return `Task '${context.taskName}' ${suffix}`;
};

const stageDescription = (context) => {
  if (!context.stageName) {
    return null;
  }
  const outcome = context.actionName
    ? `outcome (${context.actionName})`
    : "completed";
  return `Stage '${context.stageName}' ${outcome}`;
};

const phaseDescription = (context) =>
  context.phaseName ? `Phase '${context.phaseName}' completed` : null;

const statusDescription = (context) =>
  context.statusName ? `Status changed to '${context.statusName}'` : null;

const progressionDescription = (eventType, context) => {
  switch (eventType) {
    case EventEnums.eventTypes.STAGE_COMPLETED:
      return stageDescription(context);
    case EventEnums.eventTypes.PHASE_COMPLETED:
      return phaseDescription(context);
    case EventEnums.eventTypes.CASE_STATUS_CHANGED:
      return statusDescription(context);
    default:
      return null;
  }
};

// Wording belongs to presentation; recorded events retain facts, not sentences.
export const formatTimelineItemDescription = (event, workflow) => {
  const context = event.contextFor(workflow);
  if (!context) {
    return storedDescription(event);
  }
  if (isTaskEvent(event.eventType)) {
    return taskDescription(event.eventType, context);
  }
  return (
    progressionDescription(event.eventType, context) || storedDescription(event)
  );
};
