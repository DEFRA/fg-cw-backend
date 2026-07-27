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
import { Role } from "../models/role.js";
import { save } from "../repositories/role.repository.js";

const createRole = async ({ user, code, description, assignable }) => {
  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  logger.info(`Creating role: "${code}"`);

  const createdAt = new Date().toISOString();
  const role = new Role({
    code,
    description,
    assignable,
    createdAt,
    updatedAt: createdAt,
  });

  await save(role);

  logger.info(`Finished: Creating role: "${role.code}"`);

  return role;
};

export const createRoleAuditDataBuilder = ([{ user, code }]) => ({
  entities: [
    {
      entity: auditEntities.ROLE,
      action: auditActions.CREATE_ROLE,
      entityid: code,
    },
  ],
  details: {
    security: buildSecurityContext(user),
  },
  security: buildAuditSecurity(auditActions.CREATE_ROLE),
  messageGroupId: `create-role-${code}`,
});

export const createRoleUseCase = withAudit(
  createRole,
  createRoleAuditDataBuilder,
);
