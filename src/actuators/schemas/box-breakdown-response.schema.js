import Joi from "joi";

// One group of dead letters that failed the same way on the same event type.
// `error` is the stored `lastError.message` verbatim, and is null for rows
// dead-lettered before any error was recorded (a message with no
// segregationRef is killed outright). `type` is the RAW stored type - the
// caller shortens it for display, so this service never has to agree with GAS
// on a display rule.
const breakdownGroup = Joi.object({
  error: Joi.string().allow("", null).required(),
  type: Joi.string().allow("", null).required(),
  count: Joi.number().integer().min(0).required(),
  firstAt: Joi.string().isoDate().allow(null).required(),
  lastAt: Joi.string().isoDate().allow(null).required(),
}).label("BreakdownGroup");

// Sorted by count descending. Always DEAD_LETTER rows only - a row that is
// still retrying is not "stuck".
export const boxBreakdownResponseSchema = Joi.object({
  groups: Joi.array().items(breakdownGroup).required(),
}).label("BoxBreakdownResponse");
