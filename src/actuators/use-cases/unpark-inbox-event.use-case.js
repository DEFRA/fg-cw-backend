import Boom from "@hapi/boom";
import {
  findStatusById,
  unparkById,
} from "../../cases/repositories/inbox.repository.js";
import { config } from "../../common/config.js";
import { UNPARK_FROM_STATUS, parkConflict } from "../../common/event-park.js";

const MAX_ATTEMPTS = parseInt(config.get("inbox.inboxMaxRetries"));

// Unparking puts a parked row back where it was parked from: DEAD_LETTER. It
// does NOT retry it - `completionAttempts`, `lastError` and `attemptHistory`
// are untouched - so an operator who wants it tried again redrives it next.
export const unparkInboxEventUseCase = async (id) => {
  const row = await unparkById(id);

  if (row) {
    return { ...row, maxAttempts: MAX_ATTEMPTS };
  }

  const status = await findStatusById(id);

  if (status === null) {
    throw Boom.notFound(`Inbox event "${id}" not found`);
  }

  throw parkConflict("Inbox", id, status, UNPARK_FROM_STATUS);
};
