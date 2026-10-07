import { dateCodec, objectIdCodec } from "../../../common/paginate.js";

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

export const CASE_LIST_SORT = { createdAt: -1, _id: -1 };

export const DOCUMENT_INCLUDE = "document";

const CASE_LIST_PAGE_SIZE = 20;

// Each series branch is an equality on caseRef. Unhinted, the planner can
// prefer a sort index that walks the range instead.
const CASE_REF_INDEX = { caseRef: 1 };

// The unique key. The wider sort indexes share its prefix, so it is named.
const CASE_KEY_INDEX = { workflowCode: 1, caseRef: 1 };

export const SERIES_PROJECTION = {
  _id: 0,
  workflowCode: 1,
  caseRefs: 1,
  latestCaseRef: 1,
};

const bound = (operator, value) =>
  value ? { [operator]: new Date(value) } : {};

const rangeFilter = ({ from, to }) =>
  from || to
    ? { createdAt: { ...bound("$gte", from), ...bound("$lte", to) } }
    : {};

const workflowFilter = ({ workflowCode }) =>
  workflowCode ? { workflowCode } : {};

export const browseFilter = (query) => ({
  ...workflowFilter(query),
  ...rangeFilter(query),
});

// Every member of each series the ref is in, plus the ref itself for a case
// with no series. Each branch is an equality on caseRef, the read's hint.
export const seriesSearchFilter = ({ ref, series, ...query }) => ({
  $or: [
    ...series.map(({ workflowCode, caseRefs }) => ({
      workflowCode,
      caseRef: { $in: caseRefs },
    })),
    { caseRef: ref },
  ],
  ...browseFilter(query),
});

export const seriesFilter = ({ ref, workflowCode }) => ({
  caseRefs: ref,
  ...workflowFilter({ workflowCode }),
});

// Every series holding any of the refs, on the multikey caseRefs index.
export const seriesContainingCursor = (caseSeries, caseRefs, { maxTimeMS }) =>
  caseSeries.find(
    { caseRefs: { $in: caseRefs } },
    { projection: SERIES_PROJECTION, maxTimeMS },
  );

export const seriesMembersCursor = (
  cases,
  { workflowCode, caseRefs },
  { maxTimeMS },
) =>
  cases.find(
    { workflowCode, caseRef: { $in: caseRefs } },
    { projection: CASE_ROW_PROJECTION, hint: CASE_KEY_INDEX, maxTimeMS },
  );

export const caseListPageOptions = ({ cursor, ...query }) => ({
  filter: browseFilter(query),
  cursor,
  sort: CASE_LIST_SORT,
  pageSize: CASE_LIST_PAGE_SIZE,
  withTotal: false,
  codecs: { createdAt: dateCodec, _id: objectIdCodec },
  project: CASE_ROW_PROJECTION,
});

// Unsorted, so there is no sort for the planner to serve; the caller orders
// the few rows in memory.
export const caseListBySeriesCursor = (cases, query, { limit, maxTimeMS }) =>
  cases.find(seriesSearchFilter(query), {
    projection: CASE_ROW_PROJECTION,
    limit,
    hint: CASE_REF_INDEX,
    maxTimeMS,
  });

// `storedBytes` measures the whole stored document before anything is removed.
export const storedCasePipeline = ({ workflowCode, caseRef }, include) => [
  { $match: { workflowCode, caseRef } },
  { $set: { storedBytes: { $bsonSize: "$$ROOT" } } },
  include === DOCUMENT_INCLUDE
    ? { $unset: "comments" }
    : { $project: { ...CASE_SUMMARY_PROJECTION, storedBytes: 1 } },
];
