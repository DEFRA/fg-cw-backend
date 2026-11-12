import Joi from "joi";

export const taskContextSchema = Joi.object({
  taskName: Joi.string().required(),
  isInput: Joi.boolean().required(),
});

export const stageContextSchema = Joi.object({
  stageName: Joi.string().allow(null).required(),
  actionName: Joi.string().allow(null).required(),
});

export const phaseContextSchema = Joi.object({
  phaseName: Joi.string().allow(null).required(),
});

export const statusContextSchema = Joi.object({
  statusName: Joi.string().allow(null).required(),
});
