import Joi from "joi";
import { comment } from "./comment.schema.js";
import { UrlSafeId } from "./url-safe-id.schema.js";

export const Task = Joi.object({
  id: UrlSafeId.required(),
  title: Joi.string().required(),
  type: Joi.string().valid("boolean").required(),
}).label("Task");

const TaskGroup = Joi.object({
  id: UrlSafeId.required(),
  title: Joi.string().required(),
  tasks: Joi.array().items(Task).min(1).required(),
}).label("TaskGroup");

const Action = Joi.object({
  id: UrlSafeId.required(),
  label: Joi.string().required(),
  comment: comment.optional(),
}).label("Action");

export const Stage = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required(),
  taskGroups: Joi.array().items(TaskGroup).required(),
  actionsTitle: Joi.string().optional(),
  actions: Joi.array().items(Action).required(),
}).label("Stage");
