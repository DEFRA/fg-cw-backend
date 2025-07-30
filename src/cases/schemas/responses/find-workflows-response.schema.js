import Joi from "joi";
import { workflowSchema } from "../workflow.schema.js";

export const findWorkflowsResponseSchema = Joi.array()
  .items(workflowSchema.Workflow)
  .required()
  .options({
    stripUnknown: true,
  })
  .label("FindWorkflowsResponse");
