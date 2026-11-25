import { toIsoOrNull } from "../common/date-helpers.js";
import { withJsonNumbers } from "./plain-json.js";

// What happened to an event besides its attempts, in the order written.
// Attempts stay in `attemptHistory`; when it arrived and was delivered are
// fields of their own. Never in a model's `toDocument()`, so a poller's `$set`
// cannot erase it: every writer appends, in the same update that changes the
// status.
export const DEAD_LETTERED = "dead-lettered";
export const REDRIVEN = "redriven";
export const PURGED_ENTRY = "purged";
export const PAYLOAD_EDITED = "payload-edited";

// Each edit keeps the payload it replaced, so the admin can show a diff; only
// the newest five keep it, so a row edited many times stays a small document.
export const KEPT_BEFORE_IMAGES = 5;

export const deadLetteredEntry = (at) => ({ kind: DEAD_LETTERED, at });

export const redrivenEntry = ({ at, by }) => ({ kind: REDRIVEN, at, by });

export const purgedEntry = ({ at, by, reasonCode, note }) => ({
  kind: PURGED_ENTRY,
  at,
  by,
  reasonCode,
  note,
});

export const payloadEditedEntry = ({ at, by, note, before }) => ({
  kind: PAYLOAD_EDITED,
  at,
  by,
  note,
  ...(before !== undefined && { before }),
});

// For an update document.
export const pushHistory = (entries) => ({
  history: { $each: entries },
});

// For an update pipeline. `$literal`, so a note or a payload holding a `$`
// string is stored as written rather than read as a field path.
export const appendHistory = (entry) => ({
  $concatArrays: [{ $ifNull: ["$history", []] }, [{ $literal: entry }]],
});

const storedHistory = { $ifNull: ["$history", []] };

const hasEntry = (kind, at) => ({
  $anyElementTrue: [
    {
      $map: {
        input: storedHistory,
        in: {
          $and: [{ $eq: ["$$this.kind", kind] }, { $eq: ["$$this.at", at] }],
        },
      },
    },
  ],
});

const legacyEntry = (kind, at, fields = {}) => ({
  $cond: [
    {
      $and: [
        { $ne: [{ $ifNull: [at, null] }, null] },
        { $not: [hasEntry(kind, at)] },
      ],
    },
    [{ kind, at, ...fields }],
    [],
  ],
});

const storedOrNull = (path) => ({ $ifNull: [path, null] });

const hasDeathSinceRedrive = {
  $anyElementTrue: [
    {
      $map: {
        input: storedHistory,
        in: {
          $and: [
            { $eq: ["$$this.kind", DEAD_LETTERED] },
            { $gt: ["$$this.at", { $ifNull: ["$lastRedrive.at", ""] }] },
          ],
        },
      },
    },
  ],
};

// Only a lone edit's before-image is the original payload: a revision of 1 is
// that edit with nothing since.
const legacyBefore = {
  $cond: [{ $eq: ["$payloadRevision", 1] }, "$originalPayload", "$$REMOVE"],
};

// A row from before the history, or from a pod that predates it, keeps only
// its last redrive, purge, edit and death, so a write replacing one stores it
// first. Every caller is fenced to a dead row, whose last failure is its death.
const legacyEntries = {
  $concatArrays: [
    legacyEntry(REDRIVEN, "$lastRedrive.at", {
      by: storedOrNull("$lastRedrive.by"),
    }),
    legacyEntry(PURGED_ENTRY, "$lastPurge.at", {
      by: storedOrNull("$lastPurge.by"),
      reasonCode: "$lastPurge.reasonCode",
      note: storedOrNull("$lastPurge.note"),
    }),
    legacyEntry(PAYLOAD_EDITED, "$lastEdit.at", {
      by: storedOrNull("$lastEdit.by"),
      note: storedOrNull("$lastEdit.note"),
      before: legacyBefore,
    }),
    {
      $cond: [
        hasDeathSinceRedrive,
        [],
        legacyEntry(DEAD_LETTERED, "$lastResubmissionDate"),
      ],
    },
  ],
};

// Merged by `at` only when something is derived, so a row written since
// keeps its stored order untouched.
const withLegacyEntries = {
  $let: {
    vars: { legacy: legacyEntries },
    in: {
      $cond: [
        { $eq: [{ $size: "$$legacy" }, 0] },
        storedHistory,
        {
          $sortArray: {
            input: { $concatArrays: [storedHistory, "$$legacy"] },
            sortBy: { at: 1 },
          },
        },
      ],
    },
  },
};

// For an operator's redrive, purge or edit in an update pipeline.
export const appendAction = (entry) => ({
  $concatArrays: [withLegacyEntries, [{ $literal: entry }]],
});

const isEdit = (entry) => ({ $eq: [`${entry}.kind`, PAYLOAD_EDITED] });

const editCount = {
  $size: { $filter: { input: "$history", cond: isEdit("$$this") } },
};

const tallied = {
  $reduce: {
    input: "$history",
    initialValue: { edits: 0, entries: [] },
    in: {
      $let: {
        vars: {
          edits: {
            $add: ["$$value.edits", { $cond: [isEdit("$$this"), 1, 0] }],
          },
        },
        in: {
          edits: "$$edits",
          entries: {
            $concatArrays: [
              "$$value.entries",
              [
                {
                  $cond: [
                    {
                      $and: [
                        isEdit("$$this"),
                        { $lte: ["$$edits", "$$withoutBefore"] },
                      ],
                    },
                    { $unsetField: { field: "before", input: "$$this" } },
                    "$$this",
                  ],
                },
              ],
            ],
          },
        },
      },
    },
  },
};

// The pipeline stage that drops `before` from every edit but the newest five.
export const keepNewestBeforeImages = {
  $set: {
    history: {
      $let: {
        vars: {
          withoutBefore: { $subtract: [editCount, KEPT_BEFORE_IMAGES] },
        },
        in: { $let: { vars: { tally: tallied }, in: "$$tally.entries" } },
      },
    },
  },
};

const orNull = (value) => value ?? null;

const FIELDS_BY_KIND = {
  [DEAD_LETTERED]: [],
  [REDRIVEN]: ["by"],
  [PURGED_ENTRY]: ["by", "reasonCode", "note"],
  [PAYLOAD_EDITED]: ["by", "note"],
};

const fieldsOf = (entry) =>
  Object.fromEntries(
    (FIELDS_BY_KIND[entry.kind] ?? []).map((key) => [key, orNull(entry[key])]),
  );

// A BSON number in a before-image is given as the JSON an edit can send back.
const beforeOf = (entry) =>
  entry.before === undefined ? {} : { before: withJsonNumbers(entry.before) };

// Rebuilt key by key: a stored Date in `at` would reach the wire as an object.
const toHistoryEntry = (entry) => ({
  kind: String(entry.kind),
  at: toIsoOrNull(entry.at),
  ...fieldsOf(entry),
  ...beforeOf(entry),
});

// Rows written before `history` existed have none and read back as [].
export const toStoredHistory = (history) =>
  (Array.isArray(history) ? history : []).map(toHistoryEntry);
