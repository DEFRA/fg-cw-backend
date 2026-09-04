import Boom from "@hapi/boom";
import {
  findStatusById,
  redriveById,
} from "../../cases/repositories/outbox.repository.js";
import { config } from "../../common/config.js";
import { redriveConflict } from "../../common/event-redrive.js";

const MAX_ATTEMPTS = parseInt(config.get("outbox.outboxMaxRetries"));

// The update is the precondition: it matches only a DEAD_LETTER row, so a
// concurrent status change loses cleanly. Nothing matched means either the row
// is gone (404) or it is no longer DEAD_LETTER (409) - one extra read tells
// them apart, and it only happens on the failure path.
export const redriveOutboxEventUseCase = async (id, { by } = {}) => {
  const row = await redriveById(id, { by });

  if (row) {
    return { ...row, maxAttempts: MAX_ATTEMPTS };
  }

  const status = await findStatusById(id);

  if (status === null) {
    throw Boom.notFound(`Outbox event "${id}" not found`);
  }

  throw redriveConflict("Outbox", id, status);
};
