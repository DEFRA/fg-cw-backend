import Joi from "joi";

// Lenient, so a legacy or odd document cannot turn a debugging read into a 500.
const nullableString = Joi.string().allow(null);
const nullableIso = Joi.string().isoDate().allow(null);

const caseRow = {
  ref: Joi.object({
    caseRef: nullableString,
    workflowCode: nullableString,
  }).label("CaseKey"),
  position: Joi.object({
    phase: nullableString,
    stage: nullableString,
    status: nullableString,
  }).label("CasePosition"),
  closed: Joi.boolean().allow(null),
  closedAt: nullableIso,
  createdAt: nullableIso,
};

export const caseRowSchema = Joi.object(caseRow).label("CaseRow");

export const caseSummarySchema = Joi.object({
  ...caseRow,
  originalConfigVersion: nullableString,
  currentConfigVersion: nullableString,
  series: Joi.object({
    latestRef: nullableString,
    refs: Joi.array().items(Joi.string()),
  })
    .allow(null)
    .label("CaseSeries"),
}).label("CaseSummary");

export const caseSearchResponseSchema = Joi.object({
  cases: Joi.array().items(caseRowSchema).required(),
  pagination: Joi.object({
    endCursor: nullableString.required(),
    hasNextPage: Joi.boolean().required(),
  })
    .required()
    .label("CaseSearchPagination"),
  total: Joi.object({
    count: Joi.number().integer().min(0).required(),
    capped: Joi.boolean().required(),
  }).label("CaseSearchTotal"),
  workflowCodes: Joi.array().items(Joi.string()),
}).label("CaseSearchResponse");

export const caseDataResponseSchema = Joi.object({
  case: caseSummarySchema.required(),
  storedBytes: Joi.number().integer().min(0).required(),
  // Returned whole and never validated inside: its shape is the workflow's.
  document: Joi.any(),
}).label("CaseDataResponse");

export const caseExistenceResponseSchema = Joi.object({
  exists: Joi.boolean().required(),
}).label("CaseExistenceResponse");
