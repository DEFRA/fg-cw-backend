import Boom from "@hapi/boom";
import { findDetailById } from "../../cases/repositories/outbox.repository.js";

export const getOutboxEventUseCase = async (id) => {
  const detail = await findDetailById(id);

  if (!detail) {
    throw Boom.notFound(`Outbox event "${id}" not found`);
  }

  return detail;
};
