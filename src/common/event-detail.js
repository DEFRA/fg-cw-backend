import { normaliseAttemptHistory } from "./last-error.js";

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

// Rebuilt from the three contract keys rather than passed through, exactly as
// the list rebuilds `lastError`: an entry written by another version must not
// leak an extra key (a stack, say) past the response schema.
// Reading one key off an entry that may be absent or malformed, kept separate
// so the rebuild below stays inside the configured complexity max of 4.
const attemptField = (entry, key, fallback) => entry?.[key] ?? fallback;

const toAttemptEntry = (entry) => ({
  at: toIsoOrNull(attemptField(entry, "at", null)),
  name: String(attemptField(entry, "name", DEFAULT_ERROR_NAME)),
  message: String(attemptField(entry, "message", "")),
});

// Always an array - `[]` on every row written before attempt history existed -
// because the detail view renders it unconditionally. Detail only: the list
// rows deliberately stay narrow.
const toAttemptHistory = (history) =>
  normaliseAttemptHistory(history).map(toAttemptEntry);

export const toDetailDocument = (doc, maxAttempts) => {
  const detail = { maxAttempts };

  for (const [key, value] of Object.entries(doc)) {
    if (key !== CLAIM_TOKEN_FIELD) {
      detail[key] = serialiseValue(value);
    }
  }

  detail._id = doc._id.toHexString();
  detail.attemptHistory = toAttemptHistory(doc.attemptHistory);

  return detail;
};
