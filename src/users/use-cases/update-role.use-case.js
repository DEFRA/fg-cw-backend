import Boom from "@hapi/boom";
import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { AccessControl } from "../../common/access-control.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { logger } from "../../common/logger.js";
import { withAudit } from "../../common/with-audit.js";
import { IdpRoles } from "../models/idp-roles.js";
import { findByCode, update } from "../repositories/role.repository.js";

const updateRole = async ({ user, code, description, assignable }) => {
  logger.info(`Updating role: "${code}"`);

  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  const role = await findByCode(code);

  if (!role) {
    throw Boom.notFound(`Role with code ${code} not found`);
  }

  role.description = description;
  role.assignable = assignable;
  role.updatedAt = new Date().toISOString();

  await update(role);

  logger.info(`Finished: Updating role: "${code}"`);

  return role;
};

export const updateRoleAuditDataBuilder = ([{ user, code }]) => ({
  entities: [
    {
      entity: auditEntities.ROLE,
      action: auditActions.UPDATE_ROLE,
      entityid: code,
    },
  ],
  details: {
    security: buildSecurityContext(user),
  },
  security: buildAuditSecurity(auditActions.UPDATE_ROLE),
  segregationRef: `update-role-${code}`,
});

export const updateRoleUseCase = withAudit(
  updateRole,
  updateRoleAuditDataBuilder,
);
