import Joi from "joi";

export const paginationSchema = Joi.object({
  hasNextPage: Joi.boolean().required(),
});

const commonRow = {
  _id: Joi.string().required(),
  eventId: Joi.string().allow(null).required(),
  // Never null: only this service can recognise its own audit topic.
  type: Joi.string().required().example("audit"),
  // A plain string, not the enum, so one rogue document cannot fail the page.
  status: Joi.string()
    .required()
    .example("DEAD_LETTER")
    .description(
      "PUBLISHED|PROCESSING|FAILED|RESUBMITTED|COMPLETED|DEAD_LETTER|PURGED",
    ),
  publicationDate: Joi.string().isoDate().allow(null).required(),
  completedAt: Joi.string().isoDate().allow(null).required(),
};

export const inboxRowSchema = Joi.object(commonRow).label("InboxEvent");

export const outboxRowSchema = Joi.object(commonRow).label("OutboxEvent");
