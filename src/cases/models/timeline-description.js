import { EventEnums } from "./event-enums.js";

const storedDescription = (event) =>
  event.description || EventEnums.eventDescriptions[event.eventType];

const taskDescription = (context, suffix) =>
  context.isInput
    ? `Task '${context.taskName}'`
    : `Task '${context.taskName}' ${suffix}`;

const stageDescription = (context) => {
  if (!context.stageName) {
    return null;
  }
  const outcome = context.actionName
    ? `outcome (${context.actionName})`
    : "completed";
  return `Stage '${context.stageName}' ${outcome}`;
};

const descriptions = {
  [EventEnums.eventTypes.TASK_COMPLETED]: (context) =>
    taskDescription(context, "completed"),
  [EventEnums.eventTypes.TASK_UPDATED]: (context) =>
    taskDescription(context, "updated"),
  [EventEnums.eventTypes.STAGE_COMPLETED]: stageDescription,
  [EventEnums.eventTypes.PHASE_COMPLETED]: (context) =>
    context.phaseName && `Phase '${context.phaseName}' completed`,
  [EventEnums.eventTypes.CASE_STATUS_CHANGED]: (context) =>
    context.statusName && `Status changed to '${context.statusName}'`,
};

// Wording belongs to presentation; recorded events retain facts, not sentences.
export const formatTimelineItemDescription = (event, workflow) => {
  const context = event.contextFor(workflow);
  if (!context) {
    return storedDescription(event);
  }
  const describe = descriptions[event.eventType];
  return describe?.(context) || storedDescription(event);
};
