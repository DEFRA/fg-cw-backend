import Joi from "joi";
import { DOCUMENT_INCLUDE } from "../../cases/repositories/case/admin-case-query.js";

const MAX_CODE = 128;
const MAX_VERSION = 64;

// The patterns workflows are stored under: a code may be upper case.
const code = () =>
  Joi.string()
    .max(MAX_CODE)
    .pattern(/^[a-zA-Z0-9-]+$/);

const version = () =>
  Joi.string()
    .max(MAX_VERSION)
    .pattern(/^\d+\.\d+\.\d+$/);

export const workflowCodeParams = Joi.object({
  code: code().required(),
}).label("WorkflowCodeParams");

export const workflowVersionParams = Joi.object({
  code: code().required(),
  version: version().required(),
}).label("WorkflowVersionParams");

export const workflowVersionQuery = Joi.object({
  include: Joi.string()
    .valid(DOCUMENT_INCLUDE)
    .description("the stored document and its endpoints' addresses"),
}).label("WorkflowVersionQuery");
