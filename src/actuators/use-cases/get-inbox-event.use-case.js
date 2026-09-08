import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findDetailById } from "../../cases/repositories/inbox.repository.js";
import { findHopsUseCase } from "./find-hops.use-case.js";

// The hops ride along because nothing knows which id to search for until this
// read has answered, so a caller could not have asked for them in parallel. A
// failed hops read is a null and a named `sectionErrors` entry, not a failed
// page.
export const getInboxEventUseCase = async (id) => {
  logger.info(`Getting inbox event "${id}"`);

  const detail = await findDetailById(id);

  if (!detail) {
    throw Boom.notFound(`Inbox event "${id}" not found`);
  }

  const sectionErrors = [];
  const hops = await findHopsUseCase(
    detail.messageId ?? detail._id,
    sectionErrors,
  );

  logger.info(`Finished: Getting inbox event "${id}"`);

  return { ...detail, hops, sectionErrors };
};
