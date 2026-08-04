import Joi from "joi";
import { comment } from "./comment.schema.js";
import { requiredRolesSchema } from "./requiredRoles.schema.js";

export const InputSchema = Joi.object({
  type: Joi.string().valid("text", "number", "date").required(),
  label: Joi.string().required(),
  hint: Joi.array().items(Joi.string()).optional(),

  // text only
  placeholder: Joi.string().optional(),
  pattern: Joi.string().optional(),
  maxlength: Joi.number().integer().positive().optional(),

  // number only
  min: Joi.number().optional(),
  max: Joi.number().optional(),
})
  .when(".type", {
    switch: [
      {
        is: "text",
        then: Joi.object({ min: Joi.forbidden(), max: Joi.forbidden() }),
      },
      {
        is: "number",
        then: Joi.object({
          placeholder: Joi.forbidden(),
          pattern: Joi.forbidden(),
          maxlength: Joi.forbidden(),
        }),
      },
      {
        is: "date",
        then: Joi.object({
          min: Joi.forbidden(),
          max: Joi.forbidden(),
          placeholder: Joi.forbidden(),
          pattern: Joi.forbidden(),
          maxlength: Joi.forbidden(),
        }),
      },
    ],
  })
  .label("input");

const componentSchema = Joi.object({
  id: Joi.string().optional(),
  component: Joi.string().optional(),
})
  .unknown()
  .label("Component");

export const Code = Joi.string().pattern(/^[A-Z0-9_]+$/);

const ConfirmOption = Joi.alternatives()
  .try(Joi.string(), componentSchema)
  .allow(null)
  .label("ConfirmOption");

const Confirm = Joi.alternatives()
  .try(
    Joi.boolean(),
    Joi.object({
      details: Joi.array().items(componentSchema).allow(null).optional(),
      yes: ConfirmOption.optional(),
      no: ConfirmOption.optional(),
    }),
  )
  .label("Confirm");

const Action = Joi.object({
  code: Code.required(),
  name: Joi.string().required(),
  comment: comment.allow(null).required(),
  checkTasks: Joi.boolean().required(),
  confirm: Confirm.optional(),
}).label("Action");

const Transition = Joi.object({
  targetPosition: Joi.string()
    .pattern(/[A-Z0-9_:]/)
    .required(),
  checkTasks: Joi.bool().required(),
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
  closes: Joi.boolean().optional(),
  transitions: Joi.array().items(Transition).required(),
}).label("Status");

export const ValueOption = Joi.object({
  code: Code.required(),
  name: Joi.string().required(),
  theme: Joi.string()
    .valid("NONE", "NEUTRAL", "INFO", "NOTICE", "ERROR", "WARN", "SUCCESS")
    .required(),
  altName: Joi.string().allow(null),
  completes: Joi.boolean().required(),
  comment: comment.optional().allow(null),
}).label("ValueOption");

export const Task = Joi.object({
  conditional: Joi.string().optional().allow(null),
  code: Code.required(),
  name: Joi.string().required(),
  mandatory: Joi.boolean().required(),
  description: Joi.alternatives()
    .try(Joi.string(), Joi.array(), Joi.valid(null))
    .required(),
  valueOptions: Joi.array().items(ValueOption).optional(),
  input: InputSchema.optional(),
  comment: comment.optional().allow(null),
  requiredRoles: requiredRolesSchema.allow(null),
}).xor("input", "valueOptions");

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
  afterContent: Joi.array().items(componentSchema).optional(),
}).label("Stage");

export const Phase = Joi.object({
  code: Code.required(),
  name: Joi.string().required(),
  stages: Joi.array().items(Stage).min(1).required(),
}).label("Phase");
