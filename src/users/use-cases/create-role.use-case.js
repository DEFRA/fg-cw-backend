import { logger } from "../../common/logger.js";
import { Role } from "../models/role.js";
import { save } from "../repositories/role.repository.js";

export const createRoleUseCase = async (props) => {
  const createdAt = new Date().toISOString();

  logger.info(`Creating role: ${props.code}`);
  const role = new Role({
    code: props.code,
    description: props.description,
    createdAt,
    updatedAt: createdAt,
  });

  await save(role);

  logger.info(`Finished: Creating role: ${role.code}`);

  return role;
};
