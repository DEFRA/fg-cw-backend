import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findDetailById } from "../repositories/inbox.repository.js";
import { config } from "../../common/config.js";
import { toDetailDocument } from "../detail/event-detail.js";
import { findHopsUseCase } from "./find-hops.use-case.js";

const DECIMAL = 10;
const MAX_ATTEMPTS = Number.parseInt(
  config.get("inbox.inboxMaxRetries"),
  DECIMAL,
);

// The hops ride along because nothing knows which id to search for until this
// read has answered, so a caller could not have asked for them in parallel. A
// failed hops read is a null and a named `sectionErrors` entry, not a failed
// page.
export const getInboxEventUseCase = async (id) => {
  logger.info(`Getting inbox event "${id}"`);

  const doc = await findDetailById(id);

  if (!doc) {
    throw Boom.notFound(`Inbox event "${id}" not found`);
  }

  const detail = toDetailDocument(doc, MAX_ATTEMPTS, "inbox");

  const sectionErrors = [];
  const hops = await findHopsUseCase(
    detail.messageId ?? detail._id,
    sectionErrors,
  );

  logger.info(`Finished: Getting inbox event "${id}"`);

  return { ...detail, hops, sectionErrors };
};
