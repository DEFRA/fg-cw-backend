import { AUDIT_INCLUDE } from "../audit/event-audit.js";
import { sectionOf } from "../../common/actuator-page-sections.js";
import { findInboxPageUseCase } from "./find-inbox-page.use-case.js";
import { findOutboxPageUseCase } from "./find-outbox-page.use-case.js";

// Audit records are asked for deliberately: a list hides them as noise, but a
// journey asks what happened to THIS message, and a hop missing from it is a
// hole in the answer.
const HOPS_PER_BOX = 20;

const readBox = (read, eventId) =>
  read({
    q: eventId,
    direction: "forward",
    pageSize: HOPS_PER_BOX,
    audit: AUDIT_INCLUDE,
  });

const rowsOf = (box, settled, sectionErrors) => {
  const page = sectionOf(box, "hops", settled, sectionErrors);

  return page === null ? null : page.data;
};

export const findHopsUseCase = async (eventId, sectionErrors) => {
  const [inbox, outbox] = await Promise.allSettled([
    readBox(findInboxPageUseCase, eventId),
    readBox(findOutboxPageUseCase, eventId),
  ]);

  return {
    inbox: rowsOf("inbox", inbox, sectionErrors),
    outbox: rowsOf("outbox", outbox, sectionErrors),
  };
};
