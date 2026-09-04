import Boom from "@hapi/boom";
import { findDetailById } from "../../cases/repositories/inbox.repository.js";

export const getInboxEventUseCase = async (id) => {
  const detail = await findDetailById(id);

  if (!detail) {
    throw Boom.notFound(`Inbox event "${id}" not found`);
  }

  return detail;
};
