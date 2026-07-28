import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createPageResponse } from "../../common/create-page-response.js";
import { withAudit } from "../../common/with-audit.js";
import { adminAccessCheckUseCase } from "./admin-access-check.use-case.js";

const viewLandingPage = ({ user }) => {
  const data = adminAccessCheckUseCase({ user });

  return createPageResponse({ user, data });
};

export const viewLandingPageAuditDataBuilder = ([{ user }]) => ({
  entities: [
    {
      entity: auditEntities.USER,
      action: auditActions.VIEW_LANDING_PAGE,
    },
  ],
  details: {
    security: buildSecurityContext(user),
  },
  security: buildAuditSecurity(auditActions.VIEW_LANDING_PAGE),
  messageGroupId: `view-landing-page-${user.id}`,
});

export const viewLandingPageUseCase = withAudit(
  viewLandingPage,
  viewLandingPageAuditDataBuilder,
);
