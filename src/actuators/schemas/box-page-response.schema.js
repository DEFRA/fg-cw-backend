import Joi from "joi";

const pagination = Joi.object({
  startCursor: Joi.string().allow(null).required(),
  endCursor: Joi.string().allow(null).required(),
  hasNextPage: Joi.boolean().required(),
  hasPreviousPage: Joi.boolean().required(),
});

const commonRow = {
  _id: Joi.string().required(),
  eventId: Joi.string().allow(null).required(),
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
  completedAt: Joi.string().isoDate().allow(null).required(),
};

// exactly two keys - `entityid` is an application/agreement reference and is
// never returned, so this object must not be `.unknown(true)`
const auditEntity = Joi.object({
  entity: Joi.string().required(),
  action: Joi.string().required(),
}).label("AuditEntity");

export const inboxPageResponseSchema = Joi.object({
  data: Joi.array()
    .items(
      Joi.object({
        ...commonRow,
        source: Joi.string().allow(null).required(),
      }).label("InboxEvent"),
    )
    .required(),
  pagination: pagination.required(),
}).label("InboxPageResponse");

export const outboxPageResponseSchema = Joi.object({
  data: Joi.array()
    .items(
      Joi.object({
        ...commonRow,
        target: Joi.string().allow(null).required(),
        auditEntities: Joi.array().items(auditEntity).allow(null).required(),
      }).label("OutboxEvent"),
    )
    .required(),
  pagination: pagination.required(),
}).label("OutboxPageResponse");
