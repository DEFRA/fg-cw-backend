import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createPageResponse } from "../../common/create-page-response.js";
import { withAudit } from "../../common/with-audit.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";
import { findCaseSeries } from "./find-case-series.use-case.js";

const constructLinksForCaseSeries = (links, caseSeriesLength) => {
  if (caseSeriesLength > 1) {
    return links.map((link) =>
      link.id === "timeline"
        ? { ...link, text: `Timeline (${caseSeriesLength})` }
        : link,
    );
  }

  return links;
};

const viewCase = async ({ caseId, tabId, user }) => {
  const data = await findCaseByIdUseCase(caseId, user, {
    params: { caseId, tabId },
  });

  const caseSeries = await findCaseSeries({
    tabId,
    caseRef: data.caseRef,
    workflowCode: data.workflowCode,
  });

  const links = constructLinksForCaseSeries(data.links, caseSeries.length);

  return createPageResponse({ user, data: { ...data, links, caseSeries } });
};

export const viewCaseAuditDataBuilder = ([{ caseId, user }], result) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.VIEW_CASE,
      entityid: result?.data?.caseRef ?? caseId,
    },
  ],
  details: {
    security: buildSecurityContext(user),
  },
  security: buildAuditSecurity(auditActions.VIEW_CASE),
  segregationRef: `view-case-${caseId}`,
});

export const viewCaseUseCase = withAudit(viewCase, viewCaseAuditDataBuilder);
