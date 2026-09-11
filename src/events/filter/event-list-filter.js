import { ObjectId } from "mongodb";
import { escapeRegex } from "../../common/escape-regex.js";
import { auditClauses } from "../audit/event-audit.js";

// Filter builder shared by the inbox and outbox list endpoints.
//
// TRADEOFF - the `q` clauses are an unindexed collection scan, accepted
// deliberately: the events list is an ops/support tool read at human pace off
// a secondary, and the SEARCH is not worth an index apiece on the hot
// claim/publish write path. Not "no indexes at all": this surface's own
// migration adds a sort-key index per box, which every insert and status flip
// maintains, and which the pollers' `{status, sortKey}` reads use too. If the
// boxes outgrow a scan, add indexes (collation-backed
// `segregationRef`; plain `messageId` / `event.id` / `traceparent`) rather
// than narrowing the search - an operator getting no rows back for a trace id
// is the failure mode this exists to prevent. `from`/`to` are the exception:
// they constrain the box's indexed sort key (`<sortKey>, _id`), so a
// time-boxed search walks that index.

const OBJECT_ID_HEX = /^[0-9a-f]{24}$/i;

// Everything Mongo's regex engine treats as syntax, so a ref containing "."
// or "+" matches literally instead of as a pattern.

// Matched exactly: an operator pastes a whole caseRef or clientRef, never a
// prefix of one.
const CASE_REF_FIELD = "event.data.caseRef";
const CLIENT_REF_FIELD = "event.data.clientRef";

const DEFAULT_TRACEPARENT_FIELD = "traceparent";

// Matched EXACTLY, never as a prefix or regex: the value an operator filters
// by was clicked out of a breakdown group, which is grouped on that exact
// stored string - a substring search would merge two failures sharing a prefix.
const LAST_ERROR_MESSAGE_FIELD = "lastError.message";

const trimmed = (value) => (typeof value === "string" ? value.trim() : "");

// Only when `q` is a plausible ObjectId - `new ObjectId("nope")` throws.
const idClauses = (value) =>
  OBJECT_ID_HEX.test(value)
    ? [{ _id: ObjectId.createFromHexString(value) }]
    : [];

const searchAlternatives = (value, eventIdField, traceparentField) => [
  { [eventIdField]: value },
  ...idClauses(value),
  { segregationRef: value },
  { segregationRef: { $regex: `^${escapeRegex(value)}`, $options: "i" } },
  { [traceparentField]: value },
  { [CASE_REF_FIELD]: value },
  { [CLIENT_REF_FIELD]: value },
];

const searchClauses = (q, eventIdField, traceparentField) => {
  const value = trimmed(q);

  return value
    ? [{ $or: searchAlternatives(value, eventIdField, traceparentField) }]
    : [];
};

// The boxes store their sort key in different types (inbox: Z-normalised ISO
// string, outbox: BSON Date), and a bound must be coerced to match - comparing
// a string bound against a Date field silently matches nothing.
const boundValue = (value, rangeIsDate) =>
  rangeIsDate ? new Date(value) : value;

// Inclusive at both ends: an operator who types the same minute into both
// boxes expects the events in that minute.
const bounds = (from, to, rangeIsDate) => ({
  ...(from ? { $gte: boundValue(from, rangeIsDate) } : {}),
  ...(to ? { $lte: boundValue(to, rangeIsDate) } : {}),
});

const errorClauses = (error) =>
  error ? [{ [LAST_ERROR_MESSAGE_FIELD]: error }] : [];

const rangeClauses = ({ from, to, rangeField, rangeIsDate }) => {
  if (!rangeField || !(from || to)) {
    return [];
  }

  return [{ [rangeField]: bounds(from, to, rangeIsDate) }];
};

const combine = (clauses) =>
  clauses.length === 1 ? clauses[0] : { $and: clauses };

// `status` alone still produces `{ status }` rather than a wrapped `$and`, so
// the pre-search query plan is unchanged.
//
// The list, the faceted counts and the failure breakdown all build their
// filter here, so the numbers above a page always describe the rows under
// them - which is why `audit` lives here rather than in any one use case.
export const buildEventListFilter = ({
  status,
  q,
  error,
  from,
  to,
  audit,
  eventIdField,
  traceparentField = DEFAULT_TRACEPARENT_FIELD,
  targetField,
  rangeField,
  rangeIsDate,
}) => {
  const clauses = [
    ...(status ? [{ status }] : []),
    ...searchClauses(q, eventIdField, traceparentField),
    ...errorClauses(error),
    ...rangeClauses({ from, to, rangeField, rangeIsDate }),
    ...auditClauses(audit, targetField),
  ];

  return clauses.length === 0 ? {} : combine(clauses);
};
