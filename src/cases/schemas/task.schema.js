import Joi from "joi";
import { comment } from "./comment.schema.js";
import { requiredRolesSchema } from "./requiredRoles.schema.js";

const componentSchema = Joi.object({
  id: Joi.string().optional(),
  component: Joi.string().optional(),
})
  .unknown()
  .label("Component");

export const Code = Joi.string().pattern(/^[A-Z0-9_]+$/);

const Action = Joi.object({
  code: Code.required(),
  name: Joi.string().required(),
  comment: comment.allow(null).required(),
  checkTasks: Joi.boolean().required(),
}).label("Action");

const Transition = Joi.object({
  targetPosition: Joi.string()
    .pattern(/[A-Z0-9_:]/)
    .required(),
  action: Action.allow(null).required(),
}).label("Transition");

export const Status = Joi.object({
  code: Code.required(),
  name: Joi.string().required(),
  theme: Joi.string()
    .valid("NEUTRAL", "INFO", "NOTICE", "ERROR", "WARN", "SUCCESS")
    .required(),
  description: Joi.string().allow(null).required(),
  interactive: Joi.boolean().required(),
  transitions: Joi.array().items(Transition).required(),
}).label("Status");

export const StatusOption = Joi.object({
  code: Code.required(),
  name: Joi.string().required(),
  completes: Joi.boolean().required(),
}).label("StatusOption");

export const Task = Joi.object({
  code: Code.required(),
  name: Joi.string().required(),
  mandatory: Joi.boolean().required(),
  description: Joi.alternatives()
    .try(Joi.string(), Joi.array(), Joi.valid(null))
    .required(),
  statusOptions: Joi.array().items(StatusOption).required(),
  comment: comment.optional().allow(null),
  requiredRoles: requiredRolesSchema.allow(null),
});

const TaskGroup = Joi.object({
  code: Code.required(),
  name: Joi.string().required(),
  description: Joi.string().allow(null).required(),
  tasks: Joi.array().items(Task).min(1).required(),
}).label("TaskGroup");

export const Stage = Joi.object({
  code: Code.required(),
  name: Joi.string().required(),
  description: Joi.string().allow(null).required(),
  taskGroups: Joi.array().items(TaskGroup).required(),
  actionsTitle: Joi.string().optional(),
  statuses: Joi.array().items(Status).required(),
  agreements: Joi.array().optional().allow(null),
  beforeContent: Joi.array().items(componentSchema).optional(),
}).label("Stage");

export const Phase = Joi.object({
  code: Code.required(),
  name: Joi.string().required(),
  stages: Joi.array().items(Stage).min(1).required(),
}).label("Phase");
