import {
  AUDIT_TARGET_FIELDS,
  isAuditTarget,
  typeLabels,
} from "./event-audit.js";
import { normaliseAttemptHistory, toStoredLastError } from "./last-error.js";

// The detail view returns the whole stored document, including the `event`
// payload - the one place that is allowed to, and only for a single row. The
// list projections stay payload-free.
//
// `claimedBy` is a live claim token: leaking it would let a caller forge the
// poller's own claim, so it is removed here as well as being projected away.
const CLAIM_TOKEN_FIELD = "claimedBy";

const DEFAULT_ERROR_NAME = "Error";

// Only top-level Date values are converted. `event` is passed through verbatim
// so the payload the FE renders is byte-for-byte what was stored.
const serialiseValue = (value) =>
  value instanceof Date ? value.toISOString() : value;

const toIsoOrNull = (value) =>
  value instanceof Date ? value.toISOString() : (value ?? null);

// Rebuilt from the three contract keys rather than passed through: an entry
// written by another version must not leak an extra key (a stack, say) past
// the response schema. Kept separate to stay inside the complexity max of 4.
const attemptField = (entry, key, fallback) => entry?.[key] ?? fallback;

// The stack IS served here - the admin surface's attempts section expands to
// reveal it - but it is still a declared key rebuilt like every other, never a
// stored object spread onto the answer. Null on an entry that has none: rows
// written before stacks were recorded, a claim-expiry sweep, a thrown string.
const attemptStack = (entry) => {
  const stack = attemptField(entry, "stack", null);

  return stack === null ? null : String(stack);
};

const toAttemptEntry = (entry) => ({
  at: toIsoOrNull(attemptField(entry, "at", null)),
  name: String(attemptField(entry, "name", DEFAULT_ERROR_NAME)),
  message: String(attemptField(entry, "message", "")),
  stack: attemptStack(entry),
});

// Always an array - `[]` on rows written before attempt history existed -
// because the detail view renders it unconditionally.
const toAttemptHistory = (history) =>
  normaliseAttemptHistory(history).map(toAttemptEntry);

const INBOX = "inbox";

const storedTypeOf = (doc, box) =>
  (box === INBOX ? doc.type : doc.event?.type) ?? null;

const isAuditRow = (doc, box) => {
  const targetField = AUDIT_TARGET_FIELDS[box];

  return Boolean(targetField) && isAuditTarget(doc[targetField]);
};

export const toDetailDocument = (doc, maxAttempts, box) => {
  const detail = { maxAttempts };

  for (const [key, value] of Object.entries(doc)) {
    if (key !== CLAIM_TOKEN_FIELD) {
      detail[key] = serialiseValue(value);
    }
  }

  detail._id = doc._id.toHexString();
  detail.attemptHistory = toAttemptHistory(doc.attemptHistory);
  // Rebuilt for the same reason the history is, and the reason the list rows
  // are: a stored `lastError` can carry a key this service never wrote, and
  // `failAction: "log"` means the response schema will report that and send it
  // anyway. The list stripped it and the detail served it.
  detail.lastError = toStoredLastError(doc.lastError);

  // Derived last, so the labels win over any stored `type`.
  Object.assign(
    detail,
    typeLabels(storedTypeOf(doc, box), isAuditRow(doc, box)),
  );

  return detail;
};
