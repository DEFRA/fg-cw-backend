import Joi from "joi";
import { EVENT_STATUSES } from "../../common/status-counts.js";

// The query surface both boxes share, in one place so the list and the counts
// endpoints cannot drift apart: they must select the same rows, or the numbers
// above a page would not describe the page.

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;
const MIN_Q = 1;
const MAX_Q = 200;
const MIN_ERROR = 1;
const MAX_ERROR = 512;
const MAX_ACTOR = 128;

const Q_DESCRIPTION =
  "exact messageId (inbox) or event id (outbox), exact _id, exact traceparent, exact event.data.caseRef or event.data.clientRef, or an exact/prefix segregationRef";

const isAfter = (from, to) => Date.parse(from) > Date.parse(to);

// Compared as instants, not as strings: "...T00:00:00Z" and
// "...T01:00:00+02:00" order the other way round lexically.
const assertRange = (value, helpers) => {
  if (value.from && value.to && isAfter(value.from, value.to)) {
    return helpers.error("any.invalid");
  }

  return value;
};

const RANGE_MESSAGES = {
  "any.invalid": '"from" must be earlier than or equal to "to"',
};

// Everything that selects rows, as opposed to positioning a page in them.
// `status` is not here: the list takes one, the counts endpoint groups by it.
const selection = () => ({
  // Free-text search. Trimmed, and whitespace-only is treated as absent
  // rather than as a 400, so clearing the box behaves like never filling it.
  // Matched per box - see common/event-list-filter.js.
  q: Joi.string()
    .trim()
    .min(MIN_Q)
    .max(MAX_Q)
    .empty("")
    .description(Q_DESCRIPTION),
  // EXACT match on the stored `lastError.message`, never a prefix or a
  // substring: the value comes from a breakdown group, which is grouped on
  // that exact string. AND-ed with everything else here.
  error: Joi.string()
    .trim()
    .min(MIN_ERROR)
    .max(MAX_ERROR)
    .empty("")
    .description("exact stored lastError.message"),
  // Inclusive at both ends and independently optional: `from` alone is
  // "since", `to` alone is "up to". Applied to the box's own sort key -
  // `eventTime` for the inbox, `publicationDate` for the outbox.
  from: Joi.string().isoDate().example("2026-06-16T00:00:00.000Z"),
  to: Joi.string().isoDate().example("2026-06-16T23:59:59.999Z"),
});

export const boxListQuery = Joi.object({
  cursor: Joi.string(),
  direction: Joi.string().valid("forward", "backward").default("forward"),
  pageSize: Joi.number()
    .integer()
    .min(MIN_PAGE_SIZE)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  status: Joi.string().valid(...EVENT_STATUSES),
  ...selection(),
})
  .custom(assertRange)
  .messages(RANGE_MESSAGES)
  .label("BoxListQuery");

// No `status`, and no cursor or page size: the counts describe the whole
// filtered box, and the numbers per status ARE the answer.
export const boxCountsQuery = Joi.object({ ...selection() })
  .custom(assertRange)
  .messages(RANGE_MESSAGES)
  .label("BoxCountsQuery");

// The breakdown takes exactly the counts selection - it is the counts endpoint
// sliced a different way. `status` is not a parameter: the breakdown is always
// and only over DEAD_LETTER rows, pinned in the repository.
export const boxBreakdownQuery = Joi.object({ ...selection() })
  .custom(assertRange)
  .messages(RANGE_MESSAGES)
  .label("BoxBreakdownQuery");

// Who a mutation is being made on behalf of. Passed through from GAS, which
// read and validated it from the operator's `x-actor` header; this service
// never invents one. Optional - an unattributed redrive is still a redrive.
export const actorQuery = Joi.object({
  by: Joi.string()
    .trim()
    .max(MAX_ACTOR)
    .empty("")
    .description("operator the mutation is made on behalf of"),
}).label("ActorQuery");
