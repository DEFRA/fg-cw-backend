import {
  eventAdded,
  eventPaths,
  eventRoots,
  eventStar,
  openEvent,
} from "./event-fields.js";

export const eventsSource = {
  name: "events",
  label: "Events, in both services",
  service: "CW",
  size: "big",
  noun: { one: "event", many: "events" },
  time: "publicationDate",
  star: eventStar,
  roots: eventRoots,
  added: eventAdded,
  answersAt: null,
  boxes: [
    { bucket: "cw.outbox", service: "CW", box: "outbox" },
    { bucket: "cw.inbox", service: "CW", box: "inbox" },
  ],
  open: openEvent,
  openPaths: [],
  paths: eventPaths,
};
