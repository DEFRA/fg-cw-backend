import Joi from "joi";
import { timelineEventTypeSchema } from "./event-type.schema.js";

export const TimelineUser = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().optional(),
  id: Joi.string().optional(),
}).label("TimelineUser");

export const timelineSchema = Joi.object({
  eventType: timelineEventTypeSchema.required(),
  createdBy: TimelineUser.required(),
  createdAt: Joi.string().isoDate().required(),
  description: Joi.string().required(),
  data: Joi.object().optional(),
}).label("TimelineSchema");
