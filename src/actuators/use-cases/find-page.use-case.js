import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import {
  PAGE_SECTIONS,
  sectionOf,
} from "../../common/actuator-page-sections.js";
import { breakdownInboxUseCase } from "./breakdown-inbox.use-case.js";
import { breakdownOutboxUseCase } from "./breakdown-outbox.use-case.js";
import { countInboxUseCase } from "./count-inbox.use-case.js";
import { countOutboxUseCase } from "./count-outbox.use-case.js";
import { findPage as findInboxPage } from "../../cases/repositories/inbox.repository.js";
import { findPage as findOutboxPage } from "../../cases/repositories/outbox.repository.js";

const INBOX = "inbox";
const OUTBOX = "outbox";

const boxUseCases = {
  [INBOX]: {
    list: findInboxPage,
    counts: countInboxUseCase,
    breakdown: breakdownInboxUseCase,
  },
  [OUTBOX]: {
    list: findOutboxPage,
    counts: countOutboxUseCase,
    breakdown: breakdownOutboxUseCase,
  },
};

// A section not asked for is never queried: it settles as null, which reads
// as absent without logging a failure.
const when = (sections, name, read) =>
  sections.includes(name) ? read() : Promise.resolve(null);

// `error` is kept off the breakdown: it IS the list of failures to narrow by.
const readBox = (box, cursor, sections, { status, pageSize, ...selection }) => {
  const { list, counts, breakdown } = boxUseCases[box];
  const { error, ...withoutError } = selection;

  return Promise.allSettled([
    when(sections, "list", () =>
      list({ ...selection, status, pageSize, cursor }),
    ),
    when(sections, "counts", () => counts(selection)),
    when(sections, "breakdown", () => breakdown(withoutError)),
  ]);
};

// Unread is not the same as empty, so a failed list stays null.
const NO_PAGE = { data: null, pagination: null };

const toPagination = (pagination) =>
  pagination
    ? {
        hasNextPage: pagination.hasNextPage,
      }
    : null;

const toSection = (box, [list, counts, breakdown]) => {
  const page = sectionOf(box, "list", list) ?? NO_PAGE;

  return {
    events: page.data,
    pagination: toPagination(page.pagination),
    counts: sectionOf(box, "counts", counts)?.counts ?? null,
    breakdown: sectionOf(box, "breakdown", breakdown),
  };
};

const rowsIn = (section) => section.events?.length ?? 0;

// Both lists failing is a failed request, not an empty page.
const noListRead = (sections, page) =>
  sections.includes("list") &&
  page.inbox.events === null &&
  page.outbox.events === null;

export const findPageUseCase = async ({
  inboxCursor,
  outboxCursor,
  sections = PAGE_SECTIONS,
  ...query
}) => {
  logger.info("Actuator page");

  const [inbox, outbox] = await Promise.all([
    readBox(INBOX, inboxCursor, sections, query),
    readBox(OUTBOX, outboxCursor, sections, query),
  ]);

  const page = {
    inbox: toSection(INBOX, inbox),
    outbox: toSection(OUTBOX, outbox),
  };

  if (noListRead(sections, page)) {
    throw Boom.badGateway("Neither box could be read");
  }

  logger.info(
    `Finished: Actuator page (${rowsIn(page.inbox)} inbox, ${rowsIn(page.outbox)} outbox)`,
  );

  return page;
};
