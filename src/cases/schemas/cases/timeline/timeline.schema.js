import Joi from "joi";
import { timelineEventTypeSchema } from "./event-type.schema.js";

export const timelineSchema = Joi.object({
  eventType: timelineEventTypeSchema,
  createdBy: Joi.string().required(),
  createdAt: Joi.string().isoDate().required(),
  description: Joi.string().required(),
  data: Joi.object().optional(),
}).label("TimelineSchema");
