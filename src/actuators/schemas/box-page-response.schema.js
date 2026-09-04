import Joi from "joi";

const pagination = Joi.object({
  startCursor: Joi.string().allow(null).required(),
  endCursor: Joi.string().allow(null).required(),
  hasNextPage: Joi.boolean().required(),
  hasPreviousPage: Joi.boolean().required(),
});

// Why the last attempt failed, as recorded by this service. Null on every
// row that has never failed and on every row written before FGP-1227.
// `name` is an error class ("TypeError") or the sweep that set it
// ("ClaimExpired"); `message` is truncated to 1024 characters and is never
// a stack; `at` is null only for a malformed stored value.
const lastError = Joi.object({
  name: Joi.string().required().example("ClaimExpired"),
  message: Joi.string().allow("").required(),
  at: Joi.string().isoDate().allow(null).required(),
}).label("EventLastError");

// The most recent redrive of this row - `by` is the operator GAS forwarded
// from its `x-actor` header, null when nobody named themselves.
const lastRedrive = Joi.object({
  at: Joi.string().isoDate().allow(null).required(),
  by: Joi.string().allow(null).required(),
}).label("EventLastRedrive");

const commonRow = {
  _id: Joi.string().required(),
  eventId: Joi.string().allow(null).required(),
  // Null on a row that stores no type at all - an audit record is not a
  // CloudEvent and has none to state.
  type: Joi.string().allow(null).required(),
  segregationRef: Joi.string().allow(null).required(),
  // deliberately a plain string, not the six-value enum: one rogue document
  // must not fail the whole page. The *query* enum is the strict one.
  status: Joi.string()
    .required()
    .example("DEAD_LETTER")
    .description(
      "PUBLISHED|PROCESSING|FAILED|RESUBMITTED|COMPLETED|DEAD_LETTER",
    ),
  // Attempts actually MADE, not granted: incremented in the same operation
  // that records a failure, so it always equals the number of attempt-history
  // entries this row has accrued since it was last redriven.
  completionAttempts: Joi.number().integer().allow(null).required(),
  maxAttempts: Joi.number().integer().required(),
  traceparent: Joi.string()
    .allow(null)
    .required()
    .example("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
    .description(
      "W3C traceparent, or a bare CDP request id, or null when the event carries neither",
    ),
  createdAt: Joi.string().isoDate().allow(null).required(),
  lastFailureAt: Joi.string().isoDate().allow(null).required(),
  lastError: lastError.allow(null).required(),
  completedAt: Joi.string().isoDate().allow(null).required(),
  lastRedrive: lastRedrive.allow(null).required(),
};

// Exported so a redrive can answer with exactly one list row - the same shape
// the caller already has on the page it redrove from.
export const inboxRowSchema = Joi.object({
  ...commonRow,
  source: Joi.string().allow(null).required(),
}).label("InboxEvent");

export const outboxRowSchema = Joi.object({
  ...commonRow,
  target: Joi.string().allow(null).required(),
}).label("OutboxEvent");

export const inboxPageResponseSchema = Joi.object({
  data: Joi.array().items(inboxRowSchema).required(),
  pagination: pagination.required(),
}).label("InboxPageResponse");

export const outboxPageResponseSchema = Joi.object({
  data: Joi.array().items(outboxRowSchema).required(),
  pagination: pagination.required(),
}).label("OutboxPageResponse");
