import Joi from "joi";
import { UrlSafeId } from "./url-safe-id.schema.js";

export const Task = Joi.object({
  id: UrlSafeId.required(),
  title: Joi.string().required(),
  type: Joi.string().valid("boolean").required(),
  hasNote: Joi.string().valid("required", "optional", "none").default("none"),
  noteRef: UrlSafeId.optional(),
}).label("Task");

const TaskGroup = Joi.object({
  id: UrlSafeId.required(),
  title: Joi.string().required(),
  tasks: Joi.array().items(Task).min(1).required(),
}).label("TaskGroup");

const Action = Joi.object({
  id: UrlSafeId.required(),
  label: Joi.string().required(),
}).label("Action");

export const Stage = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required(),
  taskGroups: Joi.array().items(TaskGroup).required(),
  actions: Joi.array().items(Action).required(),
}).label("Stage");
