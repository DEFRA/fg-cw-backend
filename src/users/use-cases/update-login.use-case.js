import { logger } from "../../common/logger.js";
import { findById, update } from "../repositories/user.repository.js";

export const updateLoginUseCase = async ({ userId }) => {
  logger.info(`Updating last login for user "${userId}"`);

  const user = await findById(userId);

  if (!user) {
    logger.warn(`User with id "${userId}" not found, skipping login update`);
    return null;
  }

  const now = new Date().toISOString();
  user.lastLoginAt = now;
  user.updatedAt = now;

  await update(user);

  logger.info(`Finished: Updating last login for User "${user.id}"`);

  return user;
};
