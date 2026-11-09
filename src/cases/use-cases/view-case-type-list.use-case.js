import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createPageResponse } from "../../common/create-page-response.js";
import { withAudit } from "../../common/with-audit.js";
import { findCaseTypesUseCase } from "./find-case-types.use-case.js";

const viewCaseTypeList = async ({ user }) => {
  const data = await findCaseTypesUseCase({ user });

  return createPageResponse({ user, data });
};

export const viewCaseTypeListAuditDataBuilder = ([{ user }]) => ({
  entities: [
    {
      entity: auditEntities.WORKFLOW,
      action: auditActions.VIEW_CASE_TYPE_LIST,
    },
  ],
  details: {
    security: buildSecurityContext(user),
  },
  security: buildAuditSecurity(auditActions.VIEW_CASE_TYPE_LIST),
  segregationRef: `view-case-type-list-${user.id}`,
});

export const viewCaseTypeListUseCase = withAudit(
  viewCaseTypeList,
  viewCaseTypeListAuditDataBuilder,
);
