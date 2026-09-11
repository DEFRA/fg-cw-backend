import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findDetailById } from "../repositories/outbox.repository.js";
import { config } from "../../common/config.js";
import { toDetailDocument } from "../detail/event-detail.js";
import { findHopsUseCase } from "./find-hops.use-case.js";

const DECIMAL = 10;
const MAX_ATTEMPTS = Number.parseInt(
  config.get("outbox.outboxMaxRetries"),
  DECIMAL,
);

export const getOutboxEventUseCase = async (id) => {
  logger.info(`Getting outbox event "${id}"`);

  const doc = await findDetailById(id);

  if (!doc) {
    throw Boom.notFound(`Outbox event "${id}" not found`);
  }

  const detail = toDetailDocument(doc, MAX_ATTEMPTS, "outbox");

  const sectionErrors = [];
  const hops = await findHopsUseCase(
    detail.event?.id ?? detail._id,
    sectionErrors,
  );

  logger.info(`Finished: Getting outbox event "${id}"`);

  return { ...detail, hops, sectionErrors };
};
