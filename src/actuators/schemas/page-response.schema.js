import Joi from "joi";
import { boxBreakdownResponseSchema } from "./box-breakdown-response.schema.js";
import { countsSchema } from "./box-counts-response.schema.js";
import {
  inboxRowSchema,
  outboxRowSchema,
  paginationSchema,
} from "./box-page-response.schema.js";

// Each section is a read of its own, so each can be missing on its own.
export const PAGE_SECTIONS = ["list", "counts", "breakdown"];
const BOXES = ["inbox", "outbox"];

// Every field is nullable and the reason is always named in `sectionErrors`.
// `events` and `pagination` go together: a list either answered or it did not.
const boxSectionSchema = (rowSchema, label) =>
  Joi.object({
    events: Joi.array().items(rowSchema).allow(null).required(),
    pagination: paginationSchema.allow(null).required(),
    counts: countsSchema.allow(null).required(),
    breakdown: boxBreakdownResponseSchema.allow(null).required(),
  }).label(label);

export const pageResponseSchema = Joi.object({
  inbox: boxSectionSchema(inboxRowSchema, "InboxPageSection").required(),
  outbox: boxSectionSchema(outboxRowSchema, "OutboxPageSection").required(),
  // Never absent, so a caller reads it without a guard.
  sectionErrors: Joi.array()
    .items(
      Joi.object({
        box: Joi.string()
          .valid(...BOXES)
          .required(),
        section: Joi.string()
          .valid(...PAGE_SECTIONS)
          .required(),
        message: Joi.string().required().example("read failed"),
      }).label("ActuatorPageSectionError"),
    )
    .required(),
}).label("ActuatorPageResponse");
