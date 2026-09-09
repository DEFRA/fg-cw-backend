import Joi from "joi";
import { EVENT_STATUSES } from "../../events/status-counts.js";

// All six keys, always. A status with no rows is a zero, never a missing key:
// the caller renders six numbers and a gap would render as a blank.
export const countsSchema = Joi.object(
  Object.fromEntries(
    EVENT_STATUSES.map((status) => [
      status,
      Joi.number().integer().min(0).required(),
    ]),
  ),
).label("EventStatusCounts");
