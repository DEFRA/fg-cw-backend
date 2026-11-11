import { defineBucket, toIso } from "../../common/buckets/bucket.js";
import { OUTBOX } from "../../events/event-types.js";
import {
  EVENT_BOX_BINS,
  EVENT_BOX_INDEXES,
  EVENT_BOX_SUMMARIES,
  eventBoxFacts,
} from "./event-box.js";

const orNull = (value) => value ?? null;

const row = {
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
};

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
    time: { field: "publicationDate", type: "date", label: "Created" },
    facts: eventBoxFacts(OUTBOX),
    refs: { ref: "Reference", trace: "Trace ID", id: "Event ID" },
    links: ["case"],
    indexes: EVENT_BOX_INDEXES,
    groupings: ["status"],
    audited: false,
    timeline: true,
    summaries: EVENT_BOX_SUMMARIES,
    bins: EVENT_BOX_BINS,
    title: { label: "Event", format: "eventType" },
    columns: [
      { key: "status", label: "Status", format: "badge", fact: "status" },
    ],
    row,
  });
