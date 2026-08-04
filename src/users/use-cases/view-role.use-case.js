import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createPageResponse } from "../../common/create-page-response.js";
import { withAudit } from "../../common/with-audit.js";
import { findRoleByCodeUseCase } from "./find-role-by-code.use-case.js";

const viewRole = async ({ user, code }) => {
  const data = await findRoleByCodeUseCase({ user, code });

  return createPageResponse({ user, data });
};

export const viewRoleAuditDataBuilder = ([{ user, code }]) => ({
  entities: [
    {
      entity: auditEntities.ROLE,
      action: auditActions.VIEW_ROLE,
      entityid: code,
    },
  ],
  details: {
    security: buildSecurityContext(user),
  },
  security: buildAuditSecurity(auditActions.VIEW_ROLE),
  segregationRef: `view-role-${user.id}`,
});

export const viewRoleUseCase = withAudit(viewRole, viewRoleAuditDataBuilder);
