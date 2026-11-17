import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createPageResponse } from "../../common/create-page-response.js";
import { withAudit } from "../../common/with-audit.js";
import { findCasesUseCase } from "./find-cases.use-case.js";

const viewCaseListByType = async ({ user, query }) => {
  const data = await findCasesUseCase({ user, query });

  return createPageResponse({ user, data });
};

export const viewCaseListByTypeAuditDataBuilder = ([{ user, query }]) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.VIEW_CASE_LIST_BY_TYPE,
    },
  ],
  details: {
    security: buildSecurityContext(user),
    query,
  },
  security: buildAuditSecurity(auditActions.VIEW_CASE_LIST_BY_TYPE),
  segregationRef: `view-case-list-by-type-${user.id}`,
});

export const viewCaseListByTypeUseCase = withAudit(
  viewCaseListByType,
  viewCaseListByTypeAuditDataBuilder,
);
