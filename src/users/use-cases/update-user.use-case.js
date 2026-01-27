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
  const isSelf = authenticatedUser.id === userId;
  const isAdmin = hasAdminIdpRole(authenticatedUser);

  if (!isSelf && !isAdmin) {
    throw Boom.forbidden(
      `User ${authenticatedUser.id} cannot update another's details`,
    );
  }

  if (props.appRoles) {
    authoriseAppRoleUpdate(authenticatedUser, isSelf, isAdmin);
  }
};

const authoriseAppRoleUpdate = (authenticatedUser, isSelf, isAdmin) => {
  if (!isAdmin) {
    throw Boom.forbidden("Only admins can update app roles");
  }

  if (isSelf) {
    throw Boom.forbidden(
      `Admin user ${authenticatedUser.id} cannot update their own app roles`,
    );
  }
};

const hasAdminIdpRole = (authenticatedUser) => {
  const idpRoles = authenticatedUser.idpRoles || [];
  return idpRoles.includes(IdpRoles.Admin);
};

const applyUpdates = (user, props) => {
  updateProfile(user, props);
  updateRoles(user, props);
};

const updateProfile = (user, props) => {
  if (props.name) {
    user.setName(props.name);
  }

  if (props.email) {
    user.setEmail(props.email);
  }
};

const updateRoles = (user, props) => {
  if (props.idpRoles) {
    user.assignIdpRoles(props.idpRoles);
  }

  if (props.appRoles) {
    const appRoles = mapToAppRoles(props.appRoles);
    user.assignAppRoles(appRoles);
  }
};

const mapToAppRoles = (appRolesProps) => {
  return Object.entries(appRolesProps).reduce((acc, [code, value]) => {
    acc[code] = new AppRole(value);
    return acc;
  }, {});
};
