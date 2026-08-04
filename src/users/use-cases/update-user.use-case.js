import Boom from "@hapi/boom";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import {
  buildSecurityContext,
  summariseAppRoles,
} from "../../common/audit-security-context.js";
import { logger } from "../../common/logger.js";
import { withAudit } from "../../common/with-audit.js";
import { AppRole } from "../models/app-role.js";
import { IdpRoles } from "../models/idp-roles.js";
import { update } from "../repositories/user.repository.js";
import { findUserByIdUseCase } from "./find-user-by-id.use-case.js";

const snapshotRoles = (user) => ({
  idpRoles: [...(user.idpRoles ?? [])],
  appRoles: summariseAppRoles(user.appRoles),
});

const updateUser = async (command) => {
  const { authenticatedUser, userId, props } = command;

  logger.info(`Updating User "${userId}"`);

  authoriseUpdateUser(authenticatedUser, userId, props);

  const user = await findUserByIdUseCase(userId);

  const editingOther = authenticatedUser.id !== userId;
  if (editingOther) {
    command.auditRoleChange = { before: snapshotRoles(user) };
  }

  applyUpdates(user, props);

  await update(user);

  if (command.auditRoleChange) {
    command.auditRoleChange.after = snapshotRoles(user);
  }

  logger.info(`Finished: Updating User "${userId}"`);

  return user;
};

const buildRoleChanges = ({ before, after }) => ({
  idpRoles: { before: before.idpRoles, after: after?.idpRoles },
  appRoles: { before: before.appRoles, after: after?.appRoles },
});

export const updateUserAuditDataBuilder = ([command], result) => {
  const { authenticatedUser, userId, auditRoleChange } = command;
  const targetUser = authenticatedUser.id !== userId ? result : undefined;

  const details = {
    security: buildSecurityContext(authenticatedUser, targetUser),
  };

  if (auditRoleChange) {
    details.changes = buildRoleChanges(auditRoleChange);
  }

  return {
    entities: [
      {
        entity: auditEntities.USER,
        action: auditActions.UPDATE_USER,
        entityid: userId,
      },
    ],
    details,
    security: buildAuditSecurity(auditActions.UPDATE_USER),
    segregationRef: `update-user-${userId}`,
  };
};

export const updateUserUseCase = withAudit(
  updateUser,
  updateUserAuditDataBuilder,
);

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
