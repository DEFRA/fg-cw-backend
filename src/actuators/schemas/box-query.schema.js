import Joi from "joi";
import { AUDIT_EXCLUDE, AUDIT_MODES } from "../../events/event-audit.js";
import { EVENT_STATUSES } from "../../events/status-counts.js";

// The query surface both boxes share, in one place so the list and the counts
// endpoints cannot drift apart: they must select the same rows, or the numbers
// above a page would not describe the page.

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;
const MIN_Q = 1;
const MAX_Q = 200;
const MIN_ERROR = 1;
// The same ceiling `lastError.message` is stored under (events/last-error.js):
// a filter has to be able to name anything the store can hold.
const MAX_ERROR = 1024;
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
  // Matched per box - see events/event-list-filter.js.
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
  // Absent means `exclude`: an operator opening the events page is looking for
  // work that moved or failed to move, and an audit record is neither. Applied
  // inside the one filter builder the list, counts and breakdown all use - see
  // events/event-audit.js. Detail endpoints do not take it: an audit event's
  // own page is reached by id and is never filtered.
  audit: Joi.string()
    .valid(...AUDIT_MODES)
    .default(AUDIT_EXCLUDE)
    .example("include")
    .description("whether audit records are included in the selection"),
});

// One cursor per box rather than one for the pair: the caller's own list is a
// merge of four sources and its cursor holds a keyset position per source, so
// a single call has to carry both of this service's positions. Everything else
// is shared, so both boxes answer the same question.
export const pageQuery = Joi.object({
  inboxCursor: Joi.string(),
  outboxCursor: Joi.string(),
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
  .label("ActuatorPageQuery");

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
