import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { AppRole } from "../models/app-role.js";
import { IdpRoles } from "../models/idp-roles.js";
import { update } from "../repositories/user.repository.js";
import { findUserByIdUseCase } from "./find-user-by-id.use-case.js";

export const updateUserUseCase = async ({
  authenticatedUser,
  userId,
  props,
}) => {
  logger.info(`Updating User "${userId}"`);

  authoriseUpdateUser(authenticatedUser, userId, props);

  const user = await findUserByIdUseCase(userId);

  applyUpdates(user, props);

  await update(user);

  logger.info(`Finished: Updating User "${userId}"`);

  return user;
};

const authoriseUpdateUser = (authenticatedUser, userId, props) => {
  if (authenticatedUser.id === userId) {
    authoriseAdminSelfRoleUpdate(authenticatedUser, props);
    return;
  }

  authoriseUpdateOtherUser(authenticatedUser);
};

const authoriseAdminSelfRoleUpdate = (authenticatedUser, props) => {
  if (!hasAdminIdpRole(authenticatedUser)) {
    return;
  }

  if (!props.idpRoles && !props.appRoles) {
    return;
  }

  throw Boom.forbidden(
    `Admin user ${authenticatedUser.id} cannot update roles`,
  );
};

const hasAdminIdpRole = (authenticatedUser) => {
  const idpRoles = authenticatedUser.idpRoles || [];
  return idpRoles.includes(IdpRoles.Admin);
};

const authoriseUpdateOtherUser = (authenticatedUser) => {
  const idpRoles = authenticatedUser.idpRoles || [];

  if (idpRoles.includes(IdpRoles.Admin)) {
    return;
  }

  throw Boom.forbidden(
    `User ${authenticatedUser.id} cannot update another's details`,
  );
};

const applyUpdates = (user, props) => {
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
      `Assigning app roles "${Object.keys(appRoles)}" to User "${user.id}"`,
    );

    user.assignAppRoles(appRoles);
  }
};
