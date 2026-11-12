import Boom from "@hapi/boom";
import {
  phaseContextSchema,
  stageContextSchema,
  statusContextSchema,
  taskContextSchema,
} from "../schemas/cases/timeline/recorded-context.schema.js";
import { EventEnums } from "./event-enums.js";
import { Position } from "./position.js";

export const isTaskEvent = (eventType) =>
  eventType === EventEnums.eventTypes.TASK_COMPLETED ||
  eventType === EventEnums.eventTypes.TASK_UPDATED;

const displayName = (name) =>
  typeof name === "string" && name.trim() ? name : null;

const validateCapturedContext = (schema, context) => {
  const { value, error } = schema.validate(context);
  if (error) {
    throw Boom.badRequest(
      `Invalid recorded timeline context: ${error.message}`,
    );
  }
  return value;
};

export const captureTaskContext = (data, workflow) => {
  const task = workflow.findTask(data);
  return validateCapturedContext(taskContextSchema, {
    taskName: task.name,
    isInput: Boolean(task.input),
  });
};

export const captureStageContext = (data, workflow) => {
  const position = new Position(data);
  const stage = workflow.getStage(position);
  const action = stage.getActionByCode(position, data.actionCode);
  return validateCapturedContext(stageContextSchema, {
    stageName: displayName(stage.name),
    actionName: displayName(action?.name),
  });
};

export const capturePhaseContext = (data, workflow) =>
  validateCapturedContext(phaseContextSchema, {
    phaseName: displayName(workflow.findPhase(data.phaseCode).name),
  });

export const captureStatusContext = (data, workflow) =>
  validateCapturedContext(statusContextSchema, {
    statusName: displayName(workflow.getStatus(new Position(data)).name),
  });

const progressionContextSchema = (eventType) => {
  switch (eventType) {
    case EventEnums.eventTypes.STAGE_COMPLETED:
      return stageContextSchema;
    case EventEnums.eventTypes.PHASE_COMPLETED:
      return phaseContextSchema;
    case EventEnums.eventTypes.CASE_STATUS_CHANGED:
      return statusContextSchema;
    default:
      return null;
  }
};

const readableContext = (result) => (result.error ? null : result.value);

// Decode only for display, retaining the original stored facts for persistence.
export const readRecordedTimelineContext = (eventType, context) => {
  const schema = isTaskEvent(eventType)
    ? taskContextSchema
    : progressionContextSchema(eventType);
  const result = schema?.validate(context, { allowUnknown: true });
  return result ? readableContext(result) : null;
};

const resolveTaskContext = (data, workflow) =>
  workflow.hasTask(data) ? captureTaskContext(data, workflow) : null;

const resolveStageContext = (data, workflow) =>
  workflow.hasPosition(data) ? captureStageContext(data, workflow) : null;

const resolvePhaseContext = (data, workflow) =>
  workflow.hasPhase(data.phaseCode)
    ? capturePhaseContext(data, workflow)
    : null;

const resolveStatusContext = (data, workflow) =>
  workflow.hasPosition(data) ? captureStatusContext(data, workflow) : null;

const resolveProgressionContext = (eventType, data, workflow) => {
  switch (eventType) {
    case EventEnums.eventTypes.STAGE_COMPLETED:
      return resolveStageContext(data, workflow);
    case EventEnums.eventTypes.PHASE_COMPLETED:
      return resolvePhaseContext(data, workflow);
    case EventEnums.eventTypes.CASE_STATUS_CHANGED:
      return resolveStatusContext(data, workflow);
    default:
      return null;
  }
};

export const resolveLegacyTimelineContext = (eventType, data, workflow) => {
  if (isTaskEvent(eventType)) {
    return resolveTaskContext(data, workflow);
  }
  return resolveProgressionContext(eventType, data, workflow);
};
