import { toIsoOrNull } from "../../../common/date-helpers.js";
import { withJsonNumbers } from "../../../events/plain-json.js";
import { orNull } from "../actuator-box.repository.js";

// Computed by the read, not stored: lifted onto the response envelope so the
// document is exactly what is stored.
const COMPUTED_FIELDS = new Set(["storedBytes"]);

const toPosition = (doc) => ({
  phase: orNull(doc.currentPhase),
  stage: orNull(doc.currentStage),
  status: orNull(doc.currentStatus),
});

export const toCaseRow = (doc) => ({
  ref: { caseRef: orNull(doc.caseRef), workflowCode: orNull(doc.workflowCode) },
  position: toPosition(doc),
  closed: orNull(doc.closed),
  closedAt: toIsoOrNull(doc.closedAt),
  createdAt: toIsoOrNull(doc.createdAt),
});

// Matched on the row's own workflow: a ref reused under another workflow is a
// different case.
const isReplaced = (series, { caseRef, workflowCode }) =>
  series.some(
    (s) =>
      s.workflowCode === workflowCode &&
      s.caseRefs?.includes(caseRef) &&
      s.latestCaseRef !== caseRef,
  );

export const toCaseListRow = (doc, series) => ({
  ...toCaseRow(doc),
  replaced: isReplaced(series, doc),
});

export const hasMembers = (series) => series?.caseRefs?.length > 1;

// In the series' own order, oldest first. A ref whose case is missing keeps
// its place, with every fact null.
const toMembers = (series, memberDocs) => {
  if (!hasMembers(series)) {
    return [];
  }

  const byRef = new Map(memberDocs.map((doc) => [doc.caseRef, doc]));

  return series.caseRefs.map((caseRef) => {
    const doc = byRef.get(caseRef) ?? {};

    return {
      caseRef,
      position: toPosition(doc),
      createdAt: toIsoOrNull(doc.createdAt),
      closedAt: toIsoOrNull(doc.closedAt),
    };
  });
};

const toSeries = (series, memberDocs) =>
  series
    ? {
        latestRef: orNull(series.latestCaseRef),
        refs: series.caseRefs ?? [],
        members: toMembers(series, memberDocs),
      }
    : null;

export const toCaseSummary = (doc, series, memberDocs) => ({
  ...toCaseRow(doc),
  originalConfigVersion: orNull(doc.originalConfigVersion ?? doc.configVersion),
  currentConfigVersion: orNull(doc.currentConfigVersion ?? doc.configVersion),
  series: toSeries(series, memberDocs),
});

export const toStoredDocument = (doc) =>
  withJsonNumbers(
    Object.fromEntries(
      Object.entries(doc).filter(([key]) => !COMPUTED_FIELDS.has(key)),
    ),
  );

const timeOf = (date) => date?.getTime?.() ?? 0;

// Newest first, then by `_id`, as the browse pages are ordered. A `createdAt`
// that is not a Date sorts last.
export const byNewestFirst = (a, b) =>
  timeOf(b.createdAt) - timeOf(a.createdAt) ||
  String(b._id).localeCompare(String(a._id));
