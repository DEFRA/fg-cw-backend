import Joi from "joi";
import { EVENT_STATUSES } from "../../common/status-counts.js";

// All six keys, always. A status with no rows is a zero, never a missing key:
// the caller renders six numbers and a gap would render as a blank.
const counts = Joi.object(
  Object.fromEntries(
    EVENT_STATUSES.map((status) => [
      status,
      Joi.number().integer().min(0).required(),
    ]),
  ),
).label("EventStatusCounts");

// One block: the box's rows per status for the given filter. There is no TYPE
// (domain/audit) facet - the filter it described is gone, and an audit row is
// counted like any other row.
export const boxCountsResponseSchema = Joi.object({
  counts: counts.required(),
}).label("BoxCountsResponse");
