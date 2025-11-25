import { logger } from "../../common/logger.js";
import { Role } from "../models/role.js";
import { save } from "../repositories/role.repository.js";

export const createRoleUseCase = async (props) => {
  const createdAt = new Date().toISOString();

  logger.debug(`Creating role: ${props.code}`);
  const role = new Role({
    code: props.code,
    description: props.description,
    createdAt,
    updatedAt: createdAt,
  });

  await save(role);

  logger.debug(`Finished: Creating role: ${role.code}`);

  return role;
};
