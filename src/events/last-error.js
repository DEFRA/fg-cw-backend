// Why the last attempt at an inbox/outbox event failed, recorded on the
// document. Flat fields only - never the error object itself, which is not
// BSON-safe.
//
// `lastError` stores a capped stack for diagnosis and does NOT serve it: the
// Last error fact draws a name, a message and an instant, so `toStoredLastError`
// below rebuilds that fact from those three contract keys and the stack stays
// behind. That rebuild, not a schema, is what keeps it there - every response
// schema here is `failAction: "log"`, so a schema could not.
//
// Attempt stacks ARE served, on the detail page's attempts section, where each
// row expands to reveal one. That is a deliberate field on the response
// schema, not a stored object passed through: the outbound mapper builds an
// attempt key by key, so a stored key nobody declared still cannot reach the
// wire.
//
// `attemptHistory` entries carry a stack too, capped harder: the detail page
// reveals one per attempt, and ten of them live on every document. At 4KB
// apiece a worst-case history is 40KB of frames - nothing against Mongo's
// 16MB limit, and the cap is what keeps it that way.
const MAX_MESSAGE_LENGTH = 1024;

// Deep enough for the frames that actually locate a failure - an async driver
// stack runs well past the default ten - and bounded so one pathological SDK
// error cannot bloat the document it is recorded on.
const MAX_STACK_LENGTH = 8192;

// Attempt stacks are capped harder than `lastError`'s, for the same reason
// their messages are: ten entries live on every document, so this is the
// figure that decides a worst-case history's size. 4KB apiece leaves the
// frames that locate a failure and puts the ceiling at 40KB.
const MAX_ATTEMPT_STACK_LENGTH = 4096;

// Attempt-history messages are truncated harder than `lastError`: ten entries
// live on every document, so 512 keeps a worst-case history well inside a sane
// document size while still leaving a readable message.
const MAX_ATTEMPT_MESSAGE_LENGTH = 512;

// Only the ten most recent attempts are kept. Long enough to see a retry
// pattern, short enough that a row that has failed thousands of times is still
// a small document.
export const MAX_ATTEMPT_HISTORY = 10;

const DEFAULT_NAME = "Error";

const CLAIM_EXPIRED_NAME = "ClaimExpired";
const CLAIM_EXPIRED_MESSAGE = "claim expired before completion";

const nameOf = (error) => error.name ?? DEFAULT_NAME;

// A stored instant is a Date on a document read straight from Mongo and an ISO
// string on one that has already been serialised; both leave as a string.
const toIsoOrNull = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value === undefined ? null : value;
};

// A thrown string has no `message`, so the value itself is the message.
// Truncated because a driver or SDK error can carry a very long body.
const messageOf = (error, maxLength) =>
  String(error.message ?? error).slice(0, maxLength);

// A thrown string, or anything else that is not an Error, has no stack to
// record - and an empty one is an absence, not an empty string.
const stackOf = (error, maxLength) =>
  String(error.stack ?? "").slice(0, maxLength) || null;

export const toLastError = (error) => {
  if (!error) {
    return null;
  }

  return {
    name: nameOf(error),
    message: messageOf(error, MAX_MESSAGE_LENGTH),
    at: new Date().toISOString(),
    stack: stackOf(error, MAX_STACK_LENGTH),
  };
};

/**
 * A STORED `lastError`, rebuilt from the three contract keys on the way out.
 *
 * Never passed through: a `lastError` written by another version of this
 * service - or by a future one - can carry a fourth key, a stack most of all,
 * and every response schema here is declared with `failAction: "log"`, which
 * logs a violation and sends the response anyway. So the schema cannot be the
 * thing that keeps a stack off the wire; this is.
 *
 * Shared by the two list rows and the detail document, because the invariant
 * was applied in one transform and missed in the parallel one - the detail
 * served the stack the list stripped.
 */
export const toStoredLastError = (value) =>
  value
    ? {
        name: String(value.name ?? DEFAULT_NAME),
        message: String(value.message ?? ""),
        at: toIsoOrNull(value.at),
      }
    : null;

// The claim-expiry sweep has no exception to record: nothing threw, the worker
// simply stopped answering, so the sweep names itself.
export const claimExpiredError = () => ({
  name: CLAIM_EXPIRED_NAME,
  message: CLAIM_EXPIRED_MESSAGE,
  at: new Date().toISOString(),
});

// The same three fields as `lastError`, with the same truncation, so a
// history entry can never carry more than the `lastError` it came from.
export const toAttemptEntry = (error) => {
  if (!error) {
    return null;
  }

  return {
    at: new Date().toISOString(),
    name: nameOf(error),
    message: messageOf(error, MAX_ATTEMPT_MESSAGE_LENGTH),
    stack: stackOf(error, MAX_ATTEMPT_STACK_LENGTH),
  };
};

export const claimExpiredAttempt = () => ({
  at: new Date().toISOString(),
  name: CLAIM_EXPIRED_NAME,
  message: CLAIM_EXPIRED_MESSAGE,
  // Nothing threw - the worker stopped answering - so there is no stack, and
  // the key is present-and-null rather than absent: every entry the detail
  // page renders has the same shape, and only its value decides whether the
  // row can be expanded.
  stack: null,
});

const asArray = (history) => (Array.isArray(history) ? history : []);

// A stored `attemptHistory` of the wrong type - or absent, as on rows written
// before it existed - reads back as `[]` rather than throwing; trimmed on the
// way in as well as out, so a document hand-edited past the cap cannot grow.
export const normaliseAttemptHistory = (history) =>
  asArray(history).slice(-MAX_ATTEMPT_HISTORY);

// No entry (a resubmission sweep calling `markAsFailed()` with no exception)
// appends nothing, exactly as it leaves `lastError` alone.
export const appendAttempt = (history, entry) => {
  if (!entry) {
    return normaliseAttemptHistory(history);
  }

  return normaliseAttemptHistory([...asArray(history), entry]);
};

// The same append as a Mongo update fragment: `$slice` applies the cap
// server-side, so an `updateMany` sweep never has to read a row first.
export const pushAttemptUpdate = (entry) => ({
  attemptHistory: { $each: [entry], $slice: -MAX_ATTEMPT_HISTORY },
});
