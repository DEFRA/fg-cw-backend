import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { sectionOf } from "../../common/actuator-page-sections.js";
import { breakdownInboxUseCase } from "./breakdown-inbox.use-case.js";
import { breakdownOutboxUseCase } from "./breakdown-outbox.use-case.js";
import { countInboxUseCase } from "./count-inbox.use-case.js";
import { countOutboxUseCase } from "./count-outbox.use-case.js";
import { findInboxPageUseCase } from "./find-inbox-page.use-case.js";
import { findOutboxPageUseCase } from "./find-outbox-page.use-case.js";

// Both boxes of this service, in one read, with one cursor per box (see
// schemas/box-query.schema.js).
//
// Degradation is per section: a failed counts, breakdown or list is a null
// plus a named `sectionErrors` entry and the page renders around it - but BOTH
// lists failing is a page with nothing on it, which is a failed request rather
// than an empty one.

const INBOX = "inbox";
const OUTBOX = "outbox";

const boxUseCases = {
  [INBOX]: {
    list: findInboxPageUseCase,
    counts: countInboxUseCase,
    breakdown: breakdownInboxUseCase,
  },
  [OUTBOX]: {
    list: findOutboxPageUseCase,
    counts: countOutboxUseCase,
    breakdown: breakdownOutboxUseCase,
  },
};

// `status` narrows the list alone: the counts group by it and the breakdown is
// pinned to DEAD_LETTER. `error` is deliberately kept off the breakdown - it
// IS the list of failures, and a caller narrowed to one error still wants to
// see the others.
const readBox = (
  box,
  cursor,
  { status, pageSize, direction, ...selection },
) => {
  const { list, counts, breakdown } = boxUseCases[box];
  const { error, ...withoutError } = selection;

  return Promise.allSettled([
    list({ ...selection, status, pageSize, direction, cursor }),
    counts(selection),
    breakdown(withoutError),
  ]);
};

// A list that did not answer leaves the pair null rather than an empty page:
// no rows is a fact about the box, and unread is a fact about this request.
const NO_PAGE = { data: null, pagination: null };

const countsOf = (box, settled, sectionErrors) =>
  sectionOf(box, "counts", settled, sectionErrors)?.counts ?? null;

const toSection = (box, [list, counts, breakdown], sectionErrors) => {
  const page = sectionOf(box, "list", list, sectionErrors) ?? NO_PAGE;

  return {
    events: page.data,
    pagination: page.pagination,
    counts: countsOf(box, counts, sectionErrors),
    breakdown: sectionOf(box, "breakdown", breakdown, sectionErrors),
  };
};

const rowsIn = (section) => section.events?.length ?? 0;

export const findPageUseCase = async ({
  inboxCursor,
  outboxCursor,
  ...query
}) => {
  logger.info("Actuator page");

  const [inbox, outbox] = await Promise.all([
    readBox(INBOX, inboxCursor, query),
    readBox(OUTBOX, outboxCursor, query),
  ]);

  const sectionErrors = [];
  const page = {
    inbox: toSection(INBOX, inbox, sectionErrors),
    outbox: toSection(OUTBOX, outbox, sectionErrors),
    sectionErrors,
  };

  if (page.inbox.events === null && page.outbox.events === null) {
    throw Boom.badGateway("Neither box could be read");
  }

  logger.info(
    `Finished: Actuator page (${rowsIn(page.inbox)} inbox, ${rowsIn(page.outbox)} outbox, ${sectionErrors.length} section errors)`,
  );

  return page;
};
