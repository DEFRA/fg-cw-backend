import {
  findSeriesMembers,
  findStoredCase,
} from "../../cases/repositories/case.repository.js";
import { findByCaseRef } from "../../cases/repositories/case-series.repository.js";
import { DOCUMENT_INCLUDE } from "../../cases/repositories/case/admin-case-query.js";
import {
  hasMembers,
  toCaseSummary,
  toStoredDocument,
} from "../../cases/repositories/case/admin-case-row.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildOperatorSecurityContext } from "../../common/audit-security-context.js";
import { findWorkflowNames } from "../../cases/repositories/workflow.repository.js";
import { toPositionNames } from "../../cases/repositories/workflow/admin-workflow-row.js";
import { auditedRead } from "../../common/audited-read.js";
import { logger } from "../../common/logger.js";
import { notFoundWithReason } from "../../common/not-found-with-reason.js";

export const CASE_NOT_FOUND = "CASE_NOT_FOUND";

const caseNotFound = () => notFoundWithReason("Case not found", CASE_NOT_FOUND);

const findSeriesOf = async ({ workflowCode, caseRef }) => {
  const [series] = await findByCaseRef({ ref: caseRef, workflowCode });
  const memberDocs = hasMembers(series)
    ? await findSeriesMembers({ workflowCode, caseRefs: series.caseRefs })
    : [];

  return { series, memberDocs };
};

// From the version the case is on now; null when it has none or it is not
// stored.
const findNamesOf = async (
  workflowCode,
  { currentConfigVersion, position },
) => {
  if (!currentConfigVersion) {
    return null;
  }

  const workflow = await findWorkflowNames({
    code: workflowCode,
    version: currentConfigVersion,
  });

  return workflow && toPositionNames(workflow, position);
};

const viewCaseData = async ({ workflowCode, caseRef, include }) => {
  const [doc, { series, memberDocs }] = await Promise.all([
    findStoredCase({ workflowCode, caseRef }, include),
    findSeriesOf({ workflowCode, caseRef }),
  ]);

  if (!doc) {
    throw caseNotFound();
  }

  logger.info(`Read case document: ${doc.storedBytes} bytes`);

  const summary = toCaseSummary(doc, series, memberDocs);

  return {
    case: { ...summary, names: await findNamesOf(workflowCode, summary) },
    storedBytes: doc.storedBytes,
    ...(include === DOCUMENT_INCLUDE
      ? { document: toStoredDocument(doc) }
      : {}),
  };
};

export const viewCaseDataAuditBuilder = ({
  workflowCode,
  caseRef,
  include,
  operator,
  caller,
}) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.VIEW_CASE_DATA,
      entityid: caseRef,
    },
  ],
  details: {
    security: buildOperatorSecurityContext(operator),
    caller,
    workflowCode,
    include: include ?? "none",
  },
  security: buildAuditSecurity(auditActions.VIEW_CASE_DATA),
  segregationRef: "admin-view-case",
});

export const viewCaseDataUseCase = auditedRead(
  viewCaseData,
  viewCaseDataAuditBuilder,
);
