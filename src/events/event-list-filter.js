import { ObjectId } from "mongodb";
import { escapeRegex } from "../common/escape-regex.js";
import { auditClauses } from "./event-audit.js";

const OBJECT_ID_HEX = /^[0-9a-f]{24}$/i;

const CASE_REF_FIELD = "event.data.caseRef";
const CLIENT_REF_FIELD = "event.data.clientRef";

const DEFAULT_TRACEPARENT_FIELD = "traceparent";

// Exact, not a prefix: breakdown groups are keyed on the exact stored message.
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

// An unindexed scan, accepted for an ops tool read at human pace.
const searchClauses = (q, eventIdField, traceparentField) => {
  const value = trimmed(q);

  return value
    ? [{ $or: searchAlternatives(value, eventIdField, traceparentField) }]
    : [];
};

// Inbox stores ISO strings and outbox Dates; a mismatched bound matches nothing.
const boundValue = (value, rangeIsDate) =>
  rangeIsDate ? new Date(value) : value;

const bounds = (from, to, rangeIsDate) => ({
  ...(from ? { $gte: boundValue(from, rangeIsDate) } : {}),
  ...(to ? { $lte: boundValue(to, rangeIsDate) } : {}),
});

const errorClauses = (error) =>
  error ? [{ [LAST_ERROR_MESSAGE_FIELD]: error }] : [];

// Walks the box's `publicationDate, _id` sort index.
const rangeClauses = ({ from, to, rangeField, rangeIsDate }) => {
  if (!rangeField || !(from || to)) {
    return [];
  }

  return [{ [rangeField]: bounds(from, to, rangeIsDate) }];
};

const combine = (clauses) =>
  clauses.length === 1 ? clauses[0] : { $and: clauses };

// The list, counts and breakdown share this filter so their figures agree.
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
