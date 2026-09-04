import Boom from "@hapi/boom";
import {
  findStatusById,
  parkById,
} from "../../cases/repositories/outbox.repository.js";
import { config } from "../../common/config.js";
import { PARK_FROM_STATUS, parkConflict } from "../../common/event-park.js";

const MAX_ATTEMPTS = parseInt(config.get("outbox.outboxMaxRetries"));

// Parking takes a poison row OUT of the retry loop for good. The update is the
// precondition - it matches only a DEAD_LETTER row - so a concurrent change
// loses cleanly. Nothing matched means either the row is gone (404) or it is
// not DEAD_LETTER (409); one extra read tells them apart, only on failure.
export const parkOutboxEventUseCase = async (id, { reason, by } = {}) => {
  const row = await parkById(id, { reason, by });

  if (row) {
    return { ...row, maxAttempts: MAX_ATTEMPTS };
  }

  const status = await findStatusById(id);

  if (status === null) {
    throw Boom.notFound(`Outbox event "${id}" not found`);
  }

  throw parkConflict("Outbox", id, status, PARK_FROM_STATUS);
};
