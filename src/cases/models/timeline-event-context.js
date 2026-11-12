import Boom from "@hapi/boom";
import Joi from "joi";
import { EventEnums } from "./event-enums.js";
import { Position } from "./position.js";

const displayName = (name) =>
  typeof name === "string" && name.trim() ? name : null;

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
      stageName: Joi.string().allow(null).required(),
      actionName: Joi.string().allow(null).required(),
    }),
    exists: (data, workflow) => workflow.hasPosition(data),
    capture: (data, workflow) => {
      const position = new Position(data);
      const stage = workflow.getStage(position);
      const action = stage.getActionByCode(position, data.actionCode);
      return {
        stageName: displayName(stage.name),
        actionName: displayName(action?.name),
      };
    },
  },
  [EventEnums.eventTypes.PHASE_COMPLETED]: {
    schema: Joi.object({ phaseName: Joi.string().allow(null).required() }),
    exists: (data, workflow) => workflow.hasPhase(data.phaseCode),
    capture: (data, workflow) => ({
      phaseName: displayName(workflow.findPhase(data.phaseCode).name),
    }),
  },
  [EventEnums.eventTypes.CASE_STATUS_CHANGED]: {
    schema: Joi.object({ statusName: Joi.string().allow(null).required() }),
    exists: (data, workflow) => workflow.hasPosition(data),
    capture: (data, workflow) => ({
      statusName: displayName(workflow.getStatus(new Position(data)).name),
    }),
  },
};

// Creation validates strictly; historical data may outlive its original schema.
export const captureTimelineContext = (eventType, data, workflow) => {
  const definition = contexts[eventType];
  const { value, error } = definition.schema.validate(
    definition.capture(data, workflow),
  );
  if (error) {
    throw Boom.badRequest(
      `Invalid recorded timeline context: ${error.message}`,
    );
  }
  return value;
};

export const recordedContextSchema = Joi.any().custom((context, helpers) => {
  const { value, error } =
    contexts[helpers.state.ancestors[0].eventType]?.schema.validate(context, {
      allowUnknown: true,
    }) ?? {};
  return error ? undefined : value;
});

export const resolveLegacyTimelineContext = (eventType, data, workflow) => {
  const definition = contexts[eventType];
  if (!definition || !definition.exists(data, workflow)) {
    return null;
  }
  return definition.capture(data, workflow);
};
