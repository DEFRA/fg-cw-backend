import { defineBucket, toIso } from "../../common/buckets/bucket.js";
import { INBOX } from "../../events/event-types.js";
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
    messageId: 1,
  },
  present: (doc) => ({
    title: orNull(doc.eventType),
    subtitle: orNull(doc.messageId),
    cells: {
      status: doc.status,
      completedAt: toIso(doc.completionDate),
    },
    link: {
      kind: "event",
      service: "caseworking",
      box: "inbox",
      id: doc._id.toString(),
    },
  }),
};

// A factory: event types are complete only after every module has loaded.
export const inboxBucket = () =>
  defineBucket({
    id: "cw.inbox",
    path: "events/cw/inbox",
    label: "CW inbox",
    service: "CW",
    shortLabel: "Inbox",
    icon: "activity",
    order: 40,
    noun: { one: "event", many: "events" },
    collection: "inbox",
    time: { field: "publicationDate", type: "isoString", label: "Received" },
    facts: eventBoxFacts(INBOX),
    refs: { ref: "Reference", trace: "Trace ID", id: "Event ID" },
    links: ["case", "config"],
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
