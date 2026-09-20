import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findDetailById } from "../../cases/repositories/inbox.repository.js";

export const getInboxEventUseCase = async (id) => {
  logger.info(`Getting inbox event "${id}"`);

  const detail = await findDetailById(id);

  if (!detail) {
    throw Boom.notFound(`Inbox event "${id}" not found`);
  }

  logger.info(`Finished: Getting inbox event "${id}"`);

  return detail;
};
