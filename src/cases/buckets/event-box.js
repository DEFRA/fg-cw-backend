import { NO_ERROR_KEY } from "../../common/buckets/error-key.js";
import { REDRIVABLE_STATUSES } from "../../events/event-redrive.js";
import { eventStatusValues } from "../../events/event-status-values.js";
import { eventTypeValues } from "../../events/event-types.js";

// What the inbox and outbox lists share.
export const eventBoxFacts = (box) => ({
  status: { label: "Status", param: "status", values: eventStatusValues },
  eventType: {
    label: "Event",
    param: "event",
    values: eventTypeValues(box),
  },
  "lastError.name": { label: "Error name", param: "errorname" },
  errorKey: {
    label: "Error",
    param: "error",
    nullAs: { value: NO_ERROR_KEY, among: { status: REDRIVABLE_STATUSES } },
  },
});

// One list index per filter shape, then the error lines and Top errors'.
export const EVENT_BOX_INDEXES = [
  ["status"],
  ["eventType"],
  ["eventType", "status"],
  ["status", "lastError.name"],
  ["status", "errorKey", "eventType"],
];

export const EVENT_BOX_SUMMARIES = [
  {
    id: "errors",
    label: "Top errors",
    by: ["errorKey", "eventType"],
    among: { status: "DEAD_LETTER" },
    top: 20,
    none: "No error recorded",
  },
];

export const EVENT_BOX_BINS = { among: { status: "DEAD_LETTER" } };
