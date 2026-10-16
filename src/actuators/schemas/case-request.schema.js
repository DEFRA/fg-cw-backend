import Joi from "joi";
import { DOCUMENT_INCLUDE } from "../../cases/repositories/case/admin-case-query.js";

const MAX_KEY = 128;

const key = () => Joi.string().trim().min(1).max(MAX_KEY);

export const caseKeyParams = Joi.object({
  workflowCode: key().required(),
  caseRef: key().required(),
}).label("CaseKeyParams");

export const caseDataQuery = Joi.object({
  include: Joi.string()
    .valid(DOCUMENT_INCLUDE)
    .description("the stored document, without caseworker notes"),
}).label("CaseDataQuery");
