import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createPageResponse } from "../../common/create-page-response.js";
import { withAudit } from "../../common/with-audit.js";
import { buildCaseDetailsTabUseCase } from "./build-case-details-tab.use-case.js";

const viewCaseTab = async ({ caseId, tabId, query, user }) => {
  const data = await buildCaseDetailsTabUseCase({
    params: { caseId, tabId },
    query,
    user,
  });

  return createPageResponse({ user, data });
};

export const viewCaseTabAuditDataBuilder = (
  [{ caseId, tabId, user }],
  result,
) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.VIEW_CASE_TAB,
      entityid: result?.data?.caseRef ?? caseId,
    },
  ],
  details: {
    security: buildSecurityContext(user),
    tabId,
  },
  security: buildAuditSecurity(auditActions.VIEW_CASE_TAB),
  segregationRef: `view-case-tab-${caseId}-${tabId}`,
});

export const viewCaseTabUseCase = withAudit(
  viewCaseTab,
  viewCaseTabAuditDataBuilder,
);
