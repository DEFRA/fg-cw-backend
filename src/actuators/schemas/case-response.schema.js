import Joi from "joi";

// Lenient, so a legacy or odd document cannot turn a debugging read into a 500.
const nullableString = Joi.string().allow(null);
const nullableIso = Joi.string().isoDate().allow(null);

const casePosition = Joi.object({
  phase: nullableString,
  stage: nullableString,
  status: nullableString,
}).label("CasePosition");

const caseRow = {
  ref: Joi.object({
    caseRef: nullableString,
    workflowCode: nullableString,
  }).label("CaseKey"),
  position: casePosition,
  closed: Joi.boolean().allow(null),
  closedAt: nullableIso,
  createdAt: nullableIso,
};

const caseSeriesMemberSchema = Joi.object({
  caseRef: Joi.string().required(),
  position: casePosition.required(),
  createdAt: nullableIso,
  closedAt: nullableIso,
}).label("CaseSeriesMember");

const positionNamesSchema = Joi.object({
  phases: Joi.array()
    .items(
      Joi.object({ code: nullableString, name: nullableString }).label(
        "PhaseName",
      ),
    )
    .required()
    .description("every phase of the version, in its order"),
  stage: nullableString.required(),
  status: nullableString.required(),
})
  .allow(null)
  .description(
    "the names of the case's version for its position; null when the case has no current version or it is not stored",
  )
  .label("PositionNames");

export const caseSummarySchema = Joi.object({
  ...caseRow,
  originalConfigVersion: nullableString,
  currentConfigVersion: nullableString,
  series: Joi.object({
    latestRef: nullableString,
    refs: Joi.array().items(Joi.string()),
    // Oldest first, and only for a series of two or more.
    members: Joi.array().items(caseSeriesMemberSchema).required(),
  })
    .allow(null)
    .label("CaseSeries"),
  names: positionNamesSchema,
}).label("CaseSummary");

export const caseDataResponseSchema = Joi.object({
  case: caseSummarySchema.required(),
  storedBytes: Joi.number().integer().min(0).required(),
  // Returned whole and never validated inside: its shape is the workflow's.
  document: Joi.any(),
}).label("CaseDataResponse");

export const caseExistenceResponseSchema = Joi.object({
  exists: Joi.boolean().required(),
}).label("CaseExistenceResponse");
