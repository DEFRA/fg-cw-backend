import Boom from "@hapi/boom";
import { auditActions, auditEntities } from "../../common/audit-constants.js";
import { logger } from "../../common/logger.js";
import { withAuditEvents } from "../../common/with-audit-events.js";
import { AppRole } from "../models/app-role.js";
import { User } from "../models/user.js";
import { upsertLogin } from "../repositories/user.repository.js";

const loginUser = async (props) => {
  logger.info(`Processing login for user with idpId "${props.idpId}"`);

  if (!props.idpRoles) {
    throw Boom.badRequest(`User with IDP id '${props.idpId}' has no 'roles'`);
  }

  const createdAt = new Date().toISOString();

  const appRoles = Object.entries(props.appRoles || {}).reduce(
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

  const upsertedUser = await upsertLogin(user);

  logger.info(
    `Finished: Processing login for User with idpId "${props.idpId}"`,
  );

  return upsertedUser;
};

export const loginUserUseCase = withAuditEvents(
  loginUser,
  ({ args, result, status }) => ({
    entities: [
      {
        entity: auditEntities.ENTITY_USER,
        action: auditActions.ACTION_LOGIN_USER,
        entityid: args[0].idpId,
      },
    ],
    details: {
      idpId: result.idpId,
      email: result.email,
      lastLogin: result.lastLoginAt,
      status,
    },
    messageGroupId: args[0].idpId,
  }),
);
