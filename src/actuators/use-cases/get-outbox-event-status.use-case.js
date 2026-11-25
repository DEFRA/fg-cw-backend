import Boom from "@hapi/boom";
import { findAttemptStatusById } from "../../cases/repositories/outbox.repository.js";

// Not audited: it reads no payload, and a redrive's watcher calls it every few
// seconds.
export const getOutboxEventStatusUseCase = async ({ id }) => {
  const status = await findAttemptStatusById(id);

  if (!status) {
    throw Boom.notFound(`Outbox event "${id}" not found`);
  }

  return status;
};
