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
  requires: null,
  noun: { one: "event", many: "events" },
  time: "publicationDate",
  star: eventStar,
  roots: eventRoots,
  added: eventAdded,
  answersAt: null,
  // The inbox's copy of an application's answers, checked as a case's are.
  listedAt: "event.data.payload.answers",
  boxes: [
    { bucket: "cw.outbox", service: "CW", box: "outbox" },
    { bucket: "cw.inbox", service: "CW", box: "inbox" },
  ],
  open: openEvent,
  openPaths: [],
  paths: eventPaths,
};
