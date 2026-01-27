import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findById } from "../repositories/user.repository.js";

export const findUserByIdUseCase = async (userId) => {
  logger.info(`Finding User by id: "${userId}"`);
  const user = await findById(userId);

  if (!user) {
    throw Boom.notFound(`User with id "${userId}" not found`);
  }

  logger.info(`Finished: Finding User by id: "${userId}"`);

  return user;
};
