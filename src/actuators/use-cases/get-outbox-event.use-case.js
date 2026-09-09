import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findDetailById } from "../../cases/repositories/outbox.repository.js";
import { findHopsUseCase } from "./find-hops.use-case.js";

export const getOutboxEventUseCase = async (id) => {
  logger.info(`Getting outbox event "${id}"`);

  const detail = await findDetailById(id);

  if (!detail) {
    throw Boom.notFound(`Outbox event "${id}" not found`);
  }

  const sectionErrors = [];
  const hops = await findHopsUseCase(
    detail.event?.id ?? detail._id,
    sectionErrors,
  );

  logger.info(`Finished: Getting outbox event "${id}"`);

  return { ...detail, hops, sectionErrors };
};
