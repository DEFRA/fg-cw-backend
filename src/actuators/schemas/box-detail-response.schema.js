import Joi from "joi";

// The stored `lastError`, same three keys as on the list row.
const lastError = Joi.object({
  name: Joi.string().required().example("ClaimExpired"),
  message: Joi.string().allow("").required(),
  at: Joi.string().isoDate().allow(null).required(),
}).label("EventDetailLastError");

// One past attempt. The same three fields as `lastError`, in the order the
// detail view renders them; `message` is truncated to 512 characters.
const attemptEntry = Joi.object({
  at: Joi.string().isoDate().allow(null).required(),
  name: Joi.string().required().example("ClaimExpired"),
  message: Joi.string().allow("").required(),
}).label("EventAttempt");

const isoOrNull = Joi.string().isoDate().allow(null);

// One whole stored document. Unlike the list projections this DOES carry the
// full `event` payload - a deliberate, approved exception for the single-row
// detail view, so an operator can see what actually failed.
//
// `claimedBy` is a live claim token and is never returned: the repository
// projects it away, and `forbidden()` here makes a regression a test failure.
// `.unknown(true)` everywhere else so a document written by another version
// still renders instead of 500-ing.
const detailCommon = {
  _id: Joi.string().required(),
  status: Joi.string()
    .required()
    .example("DEAD_LETTER")
    .description(
      "PUBLISHED|PROCESSING|FAILED|RESUBMITTED|COMPLETED|DEAD_LETTER|PARKED",
    ),
  // Attempts actually MADE, not granted: incremented in the same operation
  // that records a failure, so it equals `attemptHistory.length` for any row
  // with fewer than ten attempts since its last redrive.
  completionAttempts: Joi.number().integer().allow(null),
  maxAttempts: Joi.number().integer().required(),
  segregationRef: Joi.string().allow(null),
  event: Joi.object().unknown(true).allow(null).required(),
  lastError: lastError.allow(null),
  // Oldest first, at most the ten most recent attempts. Always present and
  // never null: `[]` on a row that has never failed and on every row written
  // before attempt history existed. Detail only - the list rows carry
  // `lastError` alone.
  attemptHistory: Joi.array().items(attemptEntry).required(),
  parked: Joi.object({
    at: isoOrNull,
    reason: Joi.string().allow(""),
    by: Joi.string().allow(null),
  })
    .allow(null)
    .label("EventDetailParked"),
  lastRedrive: Joi.object({ at: isoOrNull, by: Joi.string().allow(null) })
    .allow(null)
    .label("EventDetailLastRedrive"),
  lastResubmissionDate: isoOrNull,
  completionDate: isoOrNull,
  publicationDate: isoOrNull,
  claimedAt: isoOrNull,
  claimExpiresAt: isoOrNull,
  claimedBy: Joi.any().forbidden(),
};

export const inboxDetailResponseSchema = Joi.object({
  ...detailCommon,
  messageId: Joi.string().allow(null),
  type: Joi.string().allow(null),
  source: Joi.string().allow(null),
  traceparent: Joi.string().allow(null),
  eventTime: isoOrNull,
})
  .unknown(true)
  .label("InboxEventDetail");

export const outboxDetailResponseSchema = Joi.object({
  ...detailCommon,
  // the full ARN, not the topic name the list row carries
  target: Joi.string().allow(null),
})
  .unknown(true)
  .label("OutboxEventDetail");
