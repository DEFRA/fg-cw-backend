// The failure breakdown, mirrored in fg-gas-backend so a group means the same
// thing whichever service produced it.
//
// Always and only DEAD_LETTER - the breakdown answers "what is stuck", and a
// row that is merely retrying is not - so `status` is not a parameter. Costs
// the same accepted collection scan as the counts (see status-counts.js);
// `$sort` runs on the distinct-failures cardinality, tiny beside the box.
//
// `type` is grouped and returned RAW, deliberately: shortening it for display
// is the caller's job, so both services can group on their own stored field
// without agreeing on a display rule.

// Generous compared with the merged cap of twenty, so a group that is 21st in
// one box but large overall is not lost before the sum happens.
export const BREAKDOWN_SOURCE_LIMIT = 100;

// `firstAt`/`lastAt` take the box's own sort key, so "first seen"/"last seen"
// mean the same thing on the breakdown as on the list. `auditExpression` puts
// into the key the one fact a null type cannot carry - see
// `auditGroupExpression` in event-audit.js.
export const breakdownStages = ({
  filter,
  typeField,
  sortKey,
  auditExpression = { $literal: false },
}) => [
  { $match: filter },
  {
    $group: {
      _id: {
        // Null on a row that died before any error was recorded (a message
        // with no segregationRef is dead-lettered outright) - its own group,
        // not dropped.
        error: { $ifNull: ["$lastError.message", null] },
        type: { $ifNull: [`$${typeField}`, null] },
        audit: auditExpression,
      },
      count: { $sum: 1 },
      firstAt: { $min: `$${sortKey}` },
      lastAt: { $max: `$${sortKey}` },
    },
  },
  { $sort: { count: -1 } },
  { $limit: BREAKDOWN_SOURCE_LIMIT },
];

const orNull = (value) => value ?? null;

const toIso = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

// Kept separate so the rebuild below stays inside the complexity max of 4.
const keyOf = (row) => row._id ?? {};

const countOf = (row) => row.count ?? 0;

export const toBreakdownGroup = (row) => {
  const key = keyOf(row);

  return {
    error: orNull(key.error),
    type: orNull(key.type),
    audit: Boolean(key.audit),
    count: countOf(row),
    firstAt: toIso(row.firstAt),
    lastAt: toIso(row.lastAt),
  };
};

export const toBreakdownGroups = (rows) => (rows ?? []).map(toBreakdownGroup);
