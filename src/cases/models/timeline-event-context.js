import Joi from "joi";
import { EventEnums } from "./event-enums.js";
import { Position } from "./position.js";

const taskContext = {
  schema: Joi.object({
    taskName: Joi.string().required(),
    isInput: Joi.boolean().required(),
  }),
  exists: (data, workflow) => workflow.hasTask(data),
  capture: (data, workflow) => {
    const task = workflow.findTask(data);
    return { taskName: task.name, isInput: Boolean(task.input) };
  },
};

// Each event's workflow references and recorded facts have one definition.
const contexts = {
  [EventEnums.eventTypes.TASK_COMPLETED]: taskContext,
  [EventEnums.eventTypes.TASK_UPDATED]: taskContext,
  [EventEnums.eventTypes.STAGE_COMPLETED]: {
    schema: Joi.object({
      stageName: Joi.string().required(),
      actionName: Joi.string().allow(null).required(),
    }),
    exists: (data, workflow) => workflow.hasPosition(data),
    capture: (data, workflow) => {
      const position = new Position(data);
      const stage = workflow.getStage(position);
      const action = stage.getActionByCode(position, data.actionCode);
      return { stageName: stage.name, actionName: action?.name ?? null };
    },
  },
  [EventEnums.eventTypes.PHASE_COMPLETED]: {
    schema: Joi.object({ phaseName: Joi.string().required() }),
    exists: (data, workflow) => workflow.hasPhase(data.phaseCode),
    capture: (data, workflow) => ({
      phaseName: workflow.findPhase(data.phaseCode).name,
    }),
  },
  [EventEnums.eventTypes.CASE_STATUS_CHANGED]: {
    schema: Joi.object({ statusName: Joi.string().required() }),
    exists: (data, workflow) => workflow.hasPosition(data),
    capture: (data, workflow) => ({
      statusName: workflow.getStatus(new Position(data)).name,
    }),
  },
};

export const recordedContextSchema = Joi.object().custom((context, helpers) => {
  const definition = contexts[helpers.state.ancestors[0].eventType];
  if (!definition) {
    return helpers.error("any.invalid");
  }
  const result = definition.schema.validate(context);
  if (result.error) {
    return helpers.error("any.invalid");
  }
  return result.value;
});

export const captureTimelineContext = (eventType, data, workflow) =>
  contexts[eventType].capture(data, workflow);

export const resolveLegacyTimelineContext = (eventType, data, workflow) => {
  const definition = contexts[eventType];
  if (!definition || !definition.exists(data, workflow)) {
    return null;
  }
  return definition.capture(data, workflow);
};
