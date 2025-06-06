import Joi from "joi";
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
});

const Workflow = WorkflowData.keys({
  _id: Joi.string().hex().length(24).required(),
}).label("Workflow");

export const workflowSchema = {
  WorkflowData,
  Workflow,
};
