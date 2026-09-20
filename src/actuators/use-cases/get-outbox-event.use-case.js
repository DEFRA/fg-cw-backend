import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findDetailById } from "../../cases/repositories/outbox.repository.js";

export const getOutboxEventUseCase = async (id) => {
  logger.info(`Getting outbox event "${id}"`);

  const detail = await findDetailById(id);

  if (!detail) {
    throw Boom.notFound(`Outbox event "${id}" not found`);
  }

  logger.info(`Finished: Getting outbox event "${id}"`);

  return detail;
};
