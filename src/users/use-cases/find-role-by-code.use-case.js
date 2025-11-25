import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findByCode } from "../repositories/role.repository.js";

export const findRoleByCodeUseCase = async (code) => {
  logger.debug(`Finding role by code: ${code}`);
  const role = await findByCode(code);
  logger.debug(`Found role ${role?.code}`);
  if (!role) {
    throw Boom.notFound(`Role with code "${code}" not found`);
  }

  logger.debug(`Finished: Finding role by code: ${code}`);

  return role;
};
