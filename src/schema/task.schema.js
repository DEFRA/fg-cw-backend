import Joi from "joi";

const Id = Joi.string().pattern(/^[a-zA-Z0-9-]+$/);

const Task = Joi.object({
  id: Id.required(),
  title: Joi.string().required(),
  type: Joi.string().valid("boolean").required()
}).label("Task");

const TaskGroup = Joi.object({
  title: Joi.string().required(),
  tasks: Joi.array().items(Task).min(1).required()
}).label("TaskGroup");

const Action = Joi.object({
  id: Id.required(),
  label: Joi.string().required()
}).label("Action");

export const Stage = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required(),
  taskGroups: Joi.array().items(TaskGroup).required(),
  actions: Joi.array().items(Action).required()
}).label("Stage");
