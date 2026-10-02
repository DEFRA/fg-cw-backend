import Joi from "joi";
import { RANGE_MESSAGES, assertRange } from "./box-query.schema.js";

const MAX_KEY = 128;
const MAX_CURSOR = 512;

const key = () => Joi.string().trim().min(1).max(MAX_KEY);

// A ref search returns the whole match on one page, so it takes no cursor.
export const caseSearchPayload = Joi.object({
  ref: key().lowercase().empty("").description("caseRef, case-insensitive"),
  workflowCode: key().empty(""),
  from: Joi.string()
    .isoDate()
    .example("2026-06-16T00:00:00.000Z")
    .description("inclusive lower bound on createdAt"),
  to: Joi.string()
    .isoDate()
    .example("2026-06-16T23:59:59.999Z")
    .description("inclusive upper bound on createdAt"),
  cursor: Joi.string().max(MAX_CURSOR),
  withTotal: Joi.boolean().description(
    "false leaves the capped total off a first page",
  ),
})
  .oxor("ref", "cursor")
  // hapi hands an empty body over as null: a browse of every case.
  .allow(null)
  .custom(assertRange)
  .messages(RANGE_MESSAGES)
  .label("CaseSearchRequest");

export const caseKeyParams = Joi.object({
  workflowCode: key().required(),
  caseRef: key().required(),
}).label("CaseKeyParams");

export const caseDataQuery = Joi.object({
  include: Joi.string()
    .valid("document")
    .description("the stored document, without caseworker notes"),
}).label("CaseDataQuery");
