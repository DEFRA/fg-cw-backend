import Boom from "@hapi/boom";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { logger } from "../../common/logger.js";
import { withAudit } from "../../common/with-audit.js";
import { findById } from "../repositories/user.repository.js";

const logoutUser = async ({ userId }) => {
  logger.info(`Processing logout for user with id "${userId}"`);

  const user = await findById(userId);

  if (!user) {
    throw Boom.notFound(`User with id '${userId}' not found`);
  }

  logger.info(`Finished: Processing logout for user with id "${userId}"`);

  return user;
};

export const logoutUserAuditDataBuilder = ([{ userId }], result) => {
  const idpId = result?.idpId;
  const details = result
    ? { security: buildSecurityContext(result) }
    : { security: { actor: { id: userId } } };

  return {
    entities: [
      {
        entity: auditEntities.USER,
        action: auditActions.LOGOUT,
        entityid: idpId,
      },
    ],
    details,
    security: buildAuditSecurity(auditActions.LOGOUT),
    messageGroupId: `logout-${idpId ?? userId}`,
  };
};

export const logoutUserUseCase = withAudit(
  logoutUser,
  logoutUserAuditDataBuilder,
);
