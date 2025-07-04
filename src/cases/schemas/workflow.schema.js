import Joi from "joi";
import { codeSchema } from "../../common/schemas/roles/code.schema.js";
import { Stage } from "./task.schema.js";

const WorkflowData = Joi.object({
  code: Joi.string()
    .pattern(/^[a-zA-Z0-9-]+$/)
    .required(),
  payloadDefinition: Joi.object()
    .pattern(Joi.string(), Joi.any())
    .min(1)
    .required(),
  stages: Joi.array().items(Stage).min(2).required(),
  requiredRoles: Joi.object({
    allOf: Joi.array().items(codeSchema).required(),
    anyOf: Joi.array().items(codeSchema).required(),
  }).required(),
});

const Workflow = WorkflowData.keys({
  _id: Joi.string().hex().length(24).required(),
}).label("Workflow");

export const workflowSchema = {
  WorkflowData,
  Workflow,
};
