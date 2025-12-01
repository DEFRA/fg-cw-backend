import { logger } from "../../common/logger.js";
import { AppRole } from "../models/app-role.js";
import { update } from "../repositories/user.repository.js";
import { findUserByIdUseCase } from "./find-user-by-id.use-case.js";

export const updateUserUseCase = async ({ userId, props }) => {
  logger.info(`Updating user by id: ${userId}`);

  const user = await findUserByIdUseCase(userId);

  if (props.name) {
    user.setName(props.name);
  }

  if (props.idpRoles) {
    user.assignIdpRoles(props.idpRoles);
  }

  if (props.appRoles) {
    const appRoles = Object.entries(props.appRoles).reduce(
      (acc, [code, value]) => {
        acc[code] = new AppRole(value);
        return acc;
      },
      {},
    );

    logger.debug(
      `Assigning app roles: ${Object.keys(appRoles)} to user ${userId}`,
    );
    user.assignAppRoles(appRoles);
  }

  await update(user);

  logger.info(`Finished: Updating user: ${userId}`);

  return user;
};
