import { logger } from "../../common/logger.js";
import { AppRole } from "../models/app-role.js";
import { User } from "../models/user.js";
import { upsert } from "../repositories/user.repository.js";

export const loginUserUseCase = async (props) => {
  logger.info(`Processing login for user with idpId "${props.idpId}"`);

  const createdAt = new Date().toISOString();

  const appRoles = Object.entries(props.appRoles).reduce(
    (acc, [code, value]) => {
      acc[code] = new AppRole(value);
      return acc;
    },
    {},
  );

  const user = new User({
    idpId: props.idpId,
    name: props.name,
    email: props.email,
    idpRoles: props.idpRoles,
    appRoles,
    createdAt,
    updatedAt: createdAt,
    lastLoginAt: createdAt,
  });

  await upsert(user);

  logger.info(
    `Finished: Processing login for User with idpId "${props.idpId}"`,
  );

  return user;
};
