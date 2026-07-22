import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createPageResponse } from "../../common/create-page-response.js";
import { withAudit } from "../../common/with-audit.js";
import { findRolesUseCase } from "./find-roles.use-case.js";

const viewRoleList = async ({ user }) => {
  const data = await findRolesUseCase({ user });

  return createPageResponse({ user, data });
};

export const viewRoleListAuditDataBuilder = ([{ user }]) => ({
  entities: [
    {
      entity: auditEntities.ROLE,
      action: auditActions.VIEW_ROLE_LIST,
    },
  ],
  details: {
    security: buildSecurityContext(user),
  },
  security: buildAuditSecurity(auditActions.VIEW_ROLE_LIST),
  messageGroupId: `view-role-list-${user.id}`,
});

export const viewRoleListUseCase = withAudit(
  viewRoleList,
  viewRoleListAuditDataBuilder,
);
