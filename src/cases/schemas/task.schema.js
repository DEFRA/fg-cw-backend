import Joi from "joi";
import { comment } from "./comment.schema.js";
import { requiredRolesSchema } from "./requiredRoles.schema.js";
import { UrlSafeId } from "./url-safe-id.schema.js";

export const Status = Joi.object({
  code: UrlSafeId.required(),
  name: Joi.string().required(),
  description: Joi.string().allow(null).required(),
}).label("Status");

export const StatusOption = Joi.object({
  code: Joi.string().required(),
  name: Joi.string().required(),
  completes: Joi.boolean().required(),
}).label("StatusOption");

export const Task = Joi.object({
  code: UrlSafeId.required(),
  type: Joi.string().valid("boolean").required(),
  name: Joi.string().required(),
  description: Joi.string().allow(null).required(),
  statusOptions: Joi.array().items(StatusOption).required(),
  comment: comment.optional(),
  requiredRoles: requiredRolesSchema.required(),
}).label("Task");

const TaskGroup = Joi.object({
  code: UrlSafeId.required(),
  name: Joi.string().required(),
  description: Joi.string().allow(null).required(),
  tasks: Joi.array().items(Task).min(1).required(),
}).label("TaskGroup");

const Action = Joi.object({
  code: UrlSafeId.required(),
  name: Joi.string().required(),
  comment: comment.optional(),
}).label("Action");

export const Stage = Joi.object({
  code: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().allow(null).required(),
  taskGroups: Joi.array().items(TaskGroup).required(),
  actionsTitle: Joi.string().optional(),
  actions: Joi.array().items(Action).required(),
  statuses: Joi.array().items(Status).required(),
  agreements: Joi.array().optional().allow(null),
}).label("Stage");
