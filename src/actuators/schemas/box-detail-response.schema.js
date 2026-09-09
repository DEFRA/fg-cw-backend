import Joi from "joi";
import { inboxRowSchema, outboxRowSchema } from "./box-page-response.schema.js";

const lastError = Joi.object({
  name: Joi.string().required().example("ClaimExpired"),
  message: Joi.string().allow("").required(),
  at: Joi.string().isoDate().allow(null).required(),
}).label("EventDetailLastError");

// `message` is truncated to 512 characters (events/last-error.js).
const attemptEntry = Joi.object({
  at: Joi.string().isoDate().allow(null).required(),
  name: Joi.string().required().example("ClaimExpired"),
  message: Joi.string().allow("").required(),
  // The stack this attempt failed with, verbatim and capped at the source, so
  // the admin surface can expand a row to reveal it. Null where there is none.
  stack: Joi.string().allow(null).required(),
}).label("EventAttempt");

const isoOrNull = Joi.string().isoDate().allow(null);

// Unlike the list projections this DOES carry the full `event` payload - a
// deliberate, approved exception for the single-row detail view.
//
// `claimedBy` is a live claim token and is never returned: the repository
// projects it away, and `forbidden()` here makes a regression a test failure.
// `.unknown(true)` everywhere else so a document written by another version
// still renders instead of 500-ing.
const detailCommon = {
  _id: Joi.string().required(),
  // Derived by the same predicate as the list row's labels (events/event-audit.js).
  // On an outbox document the stored type lives inside the wrapped event, so
  // this is the only place the detail view states it at the top level.
  type: Joi.string().required().example("audit"),
  fullType: Joi.string().required().example("Audit record — not a CloudEvent"),
  status: Joi.string()
    .required()
    .example("DEAD_LETTER")
    .description(
      "PUBLISHED|PROCESSING|FAILED|RESUBMITTED|COMPLETED|DEAD_LETTER",
    ),
  // Attempts actually MADE - see ATTEMPT ARITHMETIC in cases/models/inbox.js.
  completionAttempts: Joi.number().integer().allow(null),
  maxAttempts: Joi.number().integer().required(),
  segregationRef: Joi.string().allow(null),
  event: Joi.object().unknown(true).allow(null).required(),
  lastError: lastError.allow(null),
  // Oldest first, at most the ten most recent attempts. Never null: `[]` on a
  // row that has never failed and on every row that predates attempt history.
  attemptHistory: Joi.array().items(attemptEntry).required(),
  lastRedrive: Joi.object({ at: isoOrNull, by: Joi.string().allow(null) })
    .allow(null)
    .label("EventDetailLastRedrive"),
  lastResubmissionDate: isoOrNull,
  completionDate: isoOrNull,
  publicationDate: isoOrNull,
  claimedAt: isoOrNull,
  claimExpiresAt: isoOrNull,
  claimedBy: Joi.any().forbidden(),
  // Every row this service holds under the same event id. They ride along
  // because the caller could not fetch them in parallel - nothing knows the id
  // to search for until this read has answered. Either box is null when its
  // read failed, and says so in `sectionErrors`.
  hops: Joi.object({
    inbox: Joi.array().items(inboxRowSchema).allow(null).required(),
    outbox: Joi.array().items(outboxRowSchema).allow(null).required(),
  })
    .required()
    .label("EventHops"),
  // Never absent, so a caller reads it without a guard.
  sectionErrors: Joi.array()
    .items(
      Joi.object({
        box: Joi.string().valid("inbox", "outbox").required(),
        section: Joi.string().valid("hops").required(),
        message: Joi.string().required().example("read failed"),
      }).label("EventDetailSectionError"),
    )
    .required(),
};

export const inboxDetailResponseSchema = Joi.object({
  ...detailCommon,
  messageId: Joi.string().allow(null),
  // no `type` here: it is derived for both boxes in `detailCommon` above, and a
  // nullable one here would let a type-less inbox row escape the label again.
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
