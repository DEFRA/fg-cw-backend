import Joi from "joi";
import { caseSchema } from "./case.schema.js";
import { workflowSchema } from "./workflow.schema.js";

const ListResponse = Joi.object({
  metadata: Joi.object({
    count: Joi.number().required(),
    page: Joi.number().required(),
    pageSize: Joi.number().required(),
    pageCount: Joi.number().required()
  }),
  data: Joi.array()
    .items(
      Joi.alternatives().try(caseSchema.Case, workflowSchema.Workflow) // Allow Type A or Type B in the array
    )
    .required(),
  status: Joi.string().valid("success", "failure").required(),
  message: Joi.string().optional()
}).label("ListResponse");

const ValidationError = Joi.object({
  statusCode: Joi.number().example(400),
  error: Joi.string().example("Bad Request"),
  message: Joi.string().example("Case id is required"),
  validation: Joi.object({
    keys: Joi.array().items(Joi.string().example("id")),
    source: Joi.string().example("payload")
  })
}).label("ValidationError");

export const commonSchema = {
  ListResponse,
  ValidationError
};
