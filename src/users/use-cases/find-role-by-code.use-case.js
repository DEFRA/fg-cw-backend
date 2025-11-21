import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findByCode } from "../repositories/role.repository.js";

export const findRoleByCodeUseCase = async (code) => {
  const role = await findByCode(code);
  logger.debug(`Found role ${role?.code}`);
  if (!role) {
    throw Boom.notFound(`Role with code "${code}" not found`);
  }

  return role;
};
