import Joi from "joi";

export const paginationSchema = Joi.object({
  startCursor: Joi.string().allow(null).required(),
  endCursor: Joi.string().allow(null).required(),
  hasNextPage: Joi.boolean().required(),
  hasPreviousPage: Joi.boolean().required(),
});

// Null on rows that have never failed and on rows that predate `lastError`.
// `name` is an error class ("TypeError") or the sweep that set it
// ("ClaimExpired"); `message` is truncated to 1024 characters and is never
// a stack; `at` is null only for a malformed stored value.
const lastError = Joi.object({
  name: Joi.string().required().example("ClaimExpired"),
  message: Joi.string().allow("").required(),
  at: Joi.string().isoDate().allow(null).required(),
}).label("EventLastError");

const commonRow = {
  _id: Joi.string().required(),
  eventId: Joi.string().allow(null).required(),
  // Never null: a type-less row is labelled "audit" or "unknown" here because
  // only this service can recognise its own audit topic - see events/event-audit.js.
  //
  // `fullType`, `traceparent`, `segregationRef` and `lastRedrive` live on the
  // detail row only: the list row carries just what its caller renders.
  type: Joi.string().required().example("audit"),
  // deliberately a plain string, not the six-value enum: one rogue document
  // must not fail the whole page. The *query* enum is the strict one.
  status: Joi.string()
    .required()
    .example("DEAD_LETTER")
    .description(
      "PUBLISHED|PROCESSING|FAILED|RESUBMITTED|COMPLETED|DEAD_LETTER",
    ),
  // Attempts actually MADE - see ATTEMPT ARITHMETIC in cases/models/inbox.js.
  completionAttempts: Joi.number().integer().allow(null).required(),
  maxAttempts: Joi.number().integer().required(),
  createdAt: Joi.string().isoDate().allow(null).required(),
  lastFailureAt: Joi.string().isoDate().allow(null).required(),
  lastError: lastError.allow(null).required(),
  completedAt: Joi.string().isoDate().allow(null).required(),
};

// Exported so a redrive can answer with exactly one list row.
export const inboxRowSchema = Joi.object({
  ...commonRow,
  source: Joi.string().allow(null).required(),
}).label("InboxEvent");

export const outboxRowSchema = Joi.object({
  ...commonRow,
  target: Joi.string().allow(null).required(),
}).label("OutboxEvent");
