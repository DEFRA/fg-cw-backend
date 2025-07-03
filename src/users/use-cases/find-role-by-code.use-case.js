import Boom from "@hapi/boom";
import { findByCode } from "../repositories/role.repository.js";

export const findRoleByCodeUseCase = async (code) => {
  const role = await findByCode(code);

  if (!role) {
    throw Boom.notFound(`Role with code "${code}" not found`);
  }

  return role;
};
