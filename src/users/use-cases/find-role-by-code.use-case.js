import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findByCode } from "../repositories/role.repository.js";

export const findRoleByCodeUseCase = async (code) => {
  logger.info(`Finding role with code "${code}"`);

  const role = await findByCode(code);

  if (!role) {
    throw Boom.notFound(`Role with code ${code} not found`);
  }

  logger.info(`Finished: Finding role by code "${code}"`);

  return role;
};
