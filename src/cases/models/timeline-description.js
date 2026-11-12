import { EventEnums } from "./event-enums.js";
import { Position } from "./position.js";

export const SNAPSHOT_DESCRIPTION_VERSION = 1;

const storedDescription = (tl) =>
  tl.description || EventEnums.eventDescriptions[tl.eventType];

// Input tasks get no suffix - the value, not the transition, is the event, and
// the frontend appends "by <user>" to whatever this returns.
const formatTaskName = (task, suffix) =>
  task.input ? `Task '${task.name}'` : `Task '${task.name}' ${suffix}`;

const formatTaskEvent = (tl, workflow, suffix) => {
  const { phaseCode, stageCode, taskGroupCode, taskCode } = tl.data;

  const taskGroup = workflow
    .findPhase(phaseCode)
    .findStage(stageCode)
    .findTaskGroup(taskGroupCode);

  return formatTaskName(taskGroup.findTask(taskCode), suffix);
};

// eslint-disable-next-line complexity
export const describeWorkflowEvent = (tl, workflow) => {
  switch (tl.eventType) {
    case EventEnums.eventTypes.TASK_COMPLETED:
      return formatTaskEvent(tl, workflow, "completed");
    case EventEnums.eventTypes.TASK_UPDATED:
      return formatTaskEvent(tl, workflow, "updated");
    case EventEnums.eventTypes.STAGE_COMPLETED: {
      const position = new Position({
        phaseCode: tl.data.phaseCode,
        stageCode: tl.data.stageCode,
        statusCode: tl.data.statusCode,
      });
      const stage = workflow.getStage(position);
      const action = stage.getActionByCode(position, tl.data.actionCode);
      const info = action ? `outcome (${action.name})` : "completed";
      return `Stage '${stage.name}' ${info}`;
    }
    case EventEnums.eventTypes.PHASE_COMPLETED: {
      const phase = workflow.findPhase(tl.data.phaseCode);
      return `Phase '${phase.name}' completed`;
    }
    case EventEnums.eventTypes.CASE_STATUS_CHANGED: {
      const phase = workflow.findPhase(tl.data.phaseCode);
      const stage = phase.findStage(tl.data.stageCode);
      const status = stage.getStatus(tl.data.statusCode);
      return `Status changed to '${status.name}'`;
    }
    default:
      return storedDescription(tl);
  }
};

const hasTaskReference = (event, phase) => {
  const stage = phase?.stages.find((s) => s.code === event.data.stageCode);
  const group = stage?.taskGroups.find(
    (g) => g.code === event.data.taskGroupCode,
  );
  return Boolean(group?.hasTask(event.data.taskCode));
};

const hasStatusReference = (event, phase) => {
  const stage = phase?.stages.find((s) => s.code === event.data.stageCode);
  return Boolean(stage?.statuses.some((s) => s.code === event.data.statusCode));
};

const historicalReferenceChecks = {
  [EventEnums.eventTypes.TASK_COMPLETED]: hasTaskReference,
  [EventEnums.eventTypes.TASK_UPDATED]: hasTaskReference,
  [EventEnums.eventTypes.STAGE_COMPLETED]: hasStatusReference,
  [EventEnums.eventTypes.CASE_STATUS_CHANGED]: hasStatusReference,
  [EventEnums.eventTypes.PHASE_COMPLETED]: (_event, phase) => Boolean(phase),
};

// Historical references can disappear without weakening current validation.
const hasHistoricalReferences = (event, workflow) => {
  const check = historicalReferenceChecks[event.eventType];
  if (!check) {
    return true;
  }
  const phase = workflow.phases.find((p) => p.code === event.data.phaseCode);
  return check(event, phase);
};

export const formatTimelineItemDescription = (event, workflow) => {
  if (
    event.descriptionVersion === SNAPSHOT_DESCRIPTION_VERSION ||
    !hasHistoricalReferences(event, workflow)
  ) {
    return storedDescription(event);
  }
  return describeWorkflowEvent(event, workflow);
};
