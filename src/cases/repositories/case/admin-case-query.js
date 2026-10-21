// The admin read model's queries over `cases` and `case_series`: top-level
// platform fields only.
// `payload` and `supplementaryData` are never named here.

export const CASE_ROW_PROJECTION = {
  _id: 1,
  caseRef: 1,
  workflowCode: 1,
  currentPhase: 1,
  currentStage: 1,
  currentStatus: 1,
  closed: 1,
  closedAt: 1,
  createdAt: 1,
};

export const CASE_SUMMARY_PROJECTION = {
  ...CASE_ROW_PROJECTION,
  originalConfigVersion: 1,
  currentConfigVersion: 1,
  configVersion: 1,
};

export const DOCUMENT_INCLUDE = "document";

// The unique key. The wider sort indexes share its prefix, so it is named.
const CASE_KEY_INDEX = { workflowCode: 1, caseRef: 1 };

export const SERIES_PROJECTION = {
  _id: 0,
  workflowCode: 1,
  caseRefs: 1,
  latestCaseRef: 1,
};

const workflowFilter = ({ workflowCode }) =>
  workflowCode ? { workflowCode } : {};

export const seriesFilter = ({ ref, workflowCode }) => ({
  caseRefs: ref,
  ...workflowFilter({ workflowCode }),
});

export const seriesMembersCursor = (
  cases,
  { workflowCode, caseRefs },
  { maxTimeMS },
) =>
  cases.find(
    { workflowCode, caseRef: { $in: caseRefs } },
    { projection: CASE_ROW_PROJECTION, hint: CASE_KEY_INDEX, maxTimeMS },
  );

// `storedBytes` measures the whole stored document before anything is removed.
export const storedCasePipeline = ({ workflowCode, caseRef }, include) => [
  { $match: { workflowCode, caseRef } },
  { $set: { storedBytes: { $bsonSize: "$$ROOT" } } },
  include === DOCUMENT_INCLUDE
    ? { $unset: "comments" }
    : { $project: { ...CASE_SUMMARY_PROJECTION, storedBytes: 1 } },
];
