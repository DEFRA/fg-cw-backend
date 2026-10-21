import { defineBucket, toIso } from "../../common/buckets/bucket.js";
import { eventStatusValues } from "../../events/event-status-values.js";
import { OUTBOX, eventTypeValues } from "../../events/event-types.js";

const orNull = (value) => value ?? null;

// A factory: event types are complete only after every module has loaded.
export const outboxBucket = () =>
  defineBucket({
    id: "cw.outbox",
    path: "events/cw/outbox",
    label: "CW outbox",
    service: "CW",
    shortLabel: "Outbox",
    icon: "activity",
    page: { id: "events", label: "CW events", shortLabel: "Events" },
    tab: "Outbox",
    order: 30,
    noun: { one: "event", many: "events" },
    collection: "outbox",
    lead: ["eventType"],
    time: { field: "publicationDate", type: "date", label: "Created" },
    facts: {
      status: { label: "Status", param: "status", values: eventStatusValues },
      eventType: {
        label: "Event",
        param: "event",
        values: eventTypeValues(OUTBOX),
        toggle: { label: "Show audit events", param: "audit" },
      },
      "lastError.name": { label: "Error name", param: "errorname" },
      errorKey: { label: "Error", param: "error" },
    },
    refs: { ref: "Reference", trace: "Trace ID", id: "Event ID" },
    links: ["case"],
    indexes: [["status"], ["status", "lastError.name"], ["status", "errorKey"]],
    groupings: ["status"],
    audited: false,
    timeline: true,
    summaries: [
      {
        id: "errors",
        label: "Top errors",
        by: ["errorKey", "eventType"],
        among: { status: "DEAD_LETTER" },
        top: 20,
        none: "No error recorded",
      },
    ],
    title: { label: "Event", format: "eventType" },
    columns: [
      { key: "status", label: "Status", format: "badge", fact: "status" },
    ],
    row: {
      projection: {
        eventType: 1,
        status: 1,
        completionDate: 1,
        "event.id": 1,
      },
      present: (doc) => ({
        title: orNull(doc.eventType),
        subtitle: orNull(doc.event?.id),
        cells: {
          status: doc.status,
          completedAt: toIso(doc.completionDate),
        },
        link: {
          kind: "event",
          service: "caseworking",
          box: "outbox",
          id: doc._id.toString(),
        },
      }),
    },
  });
