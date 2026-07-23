import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createPageResponse } from "../../common/create-page-response.js";
import { withAudit } from "../../common/with-audit.js";
import { findCasesUseCase } from "./find-cases.use-case.js";

const viewCaseList = async ({ user, query }) => {
  const data = await findCasesUseCase({ user, query });

  return createPageResponse({ user, data });
};

export const viewCaseListAuditDataBuilder = ([{ user, query }]) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.VIEW_CASE_LIST,
    },
  ],
  details: {
    security: buildSecurityContext(user),
    query,
  },
  security: buildAuditSecurity(auditActions.VIEW_CASE_LIST),
  messageGroupId: `view-case-list-${user.id}`,
});

export const viewCaseListUseCase = withAudit(
  viewCaseList,
  viewCaseListAuditDataBuilder,
);
