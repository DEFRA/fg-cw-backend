import Joi from "joi";
import { boxBreakdownResponseSchema } from "./box-breakdown-response.schema.js";
import { countsSchema } from "./box-counts-response.schema.js";
import {
  inboxRowSchema,
  outboxRowSchema,
  paginationSchema,
} from "./box-page-response.schema.js";

// A section that could not be read is null; why is logged, not served.
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
}).label("ActuatorPageResponse");
