import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createPageResponse } from "../../common/create-page-response.js";
import { withAudit } from "../../common/with-audit.js";
import { adminFindUsersUseCase } from "./admin-find-users.use-case.js";

const adminViewUserList = async ({ user, query }) => {
  const data = await adminFindUsersUseCase({ user, query });

  return createPageResponse({ user, data });
};

export const adminViewUserListAuditDataBuilder = ([{ user, query }]) => ({
  entities: [
    {
      entity: auditEntities.USER,
      action: auditActions.VIEW_USER_LIST,
    },
  ],
  details: {
    security: buildSecurityContext(user),
    query,
  },
  security: buildAuditSecurity(auditActions.VIEW_USER_LIST),
  segregationRef: `view-user-list-${user.id}`,
});

export const adminViewUserListUseCase = withAudit(
  adminViewUserList,
  adminViewUserListAuditDataBuilder,
);
