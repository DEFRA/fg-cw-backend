import Joi from "joi";

// `error` is the stored `lastError.message` verbatim, and is null for rows
// dead-lettered before any error was recorded (a message with no
// segregationRef is killed outright). `type` is the RAW stored type - the
// caller shortens it for display, so this service never has to agree with GAS
// on a display rule.
const breakdownGroup = Joi.object({
  error: Joi.string().allow("", null).required(),
  type: Joi.string().allow("", null).required(),
  // A grouping fact, not a display value: an audit record and a type-less
  // anomaly both group under a null type, so the flag tells them apart. The
  // caller resolves and drops it - see fg-gas-backend's merge-breakdown-groups.js.
  audit: Joi.boolean().required(),
  count: Joi.number().integer().min(0).required(),
  firstAt: Joi.string().isoDate().allow(null).required(),
  lastAt: Joi.string().isoDate().allow(null).required(),
}).label("BreakdownGroup");

// Sorted by count descending. Always DEAD_LETTER rows only - a row that is
// still retrying is not "stuck".
export const boxBreakdownResponseSchema = Joi.object({
  groups: Joi.array().items(breakdownGroup).required(),
}).label("BoxBreakdownResponse");
