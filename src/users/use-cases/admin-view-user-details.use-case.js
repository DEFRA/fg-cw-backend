import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createPageResponse } from "../../common/create-page-response.js";
import { withAudit } from "../../common/with-audit.js";
import { adminFindUserByIdUseCase } from "./admin-find-user-by-id.use-case.js";

const adminViewUserDetails = async ({ user, userId }) => {
  const data = await adminFindUserByIdUseCase({ user, userId });

  return createPageResponse({ user, data });
};

export const adminViewUserDetailsAuditDataBuilder = ([{ user, userId }]) => ({
  entities: [
    {
      entity: auditEntities.USER,
      action: auditActions.VIEW_USER_DETAILS,
      entityid: userId,
    },
  ],
  details: {
    security: buildSecurityContext(user),
  },
  security: buildAuditSecurity(auditActions.VIEW_USER_DETAILS),
  messageGroupId: `view-user-details-${userId}`,
});

export const adminViewUserDetailsUseCase = withAudit(
  adminViewUserDetails,
  adminViewUserDetailsAuditDataBuilder,
);
