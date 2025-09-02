import Joi from "joi";
import { EventEnums } from "../../../models/event-enums.js";

export const timelineEventTypeSchema = Joi.string().valid(
  ...Object.values(EventEnums.eventTypes),
);
