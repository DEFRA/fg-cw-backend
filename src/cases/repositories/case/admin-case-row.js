import { toIsoOrNull } from "../../../common/date-helpers.js";
import { withJsonNumbers } from "../../../events/plain-json.js";
import { orNull } from "../actuator-box.repository.js";

// Computed by the read, not stored: lifted onto the response envelope so the
// document is exactly what is stored.
const COMPUTED_FIELDS = new Set(["storedBytes"]);

export const toCaseRow = (doc) => ({
  ref: { caseRef: orNull(doc.caseRef), workflowCode: orNull(doc.workflowCode) },
  position: {
    phase: orNull(doc.currentPhase),
    stage: orNull(doc.currentStage),
    status: orNull(doc.currentStatus),
  },
  closed: orNull(doc.closed),
  closedAt: toIsoOrNull(doc.closedAt),
  createdAt: toIsoOrNull(doc.createdAt),
});

const toSeries = (series) =>
  series
    ? { latestRef: orNull(series.latestCaseRef), refs: series.caseRefs ?? [] }
    : null;

export const toCaseSummary = (doc, series) => ({
  ...toCaseRow(doc),
  originalConfigVersion: orNull(doc.originalConfigVersion ?? doc.configVersion),
  currentConfigVersion: orNull(doc.currentConfigVersion ?? doc.configVersion),
  series: toSeries(series),
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
