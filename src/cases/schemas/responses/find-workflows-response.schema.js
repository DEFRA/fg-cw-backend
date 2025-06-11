import Joi from "joi";
import { workflowSchema } from "../workflow.schema.js";

export const findWorkflowsResponseSchema = Joi.array()
  .items(workflowSchema.Workflow)
  .required()
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindWorkflowsResponse");
