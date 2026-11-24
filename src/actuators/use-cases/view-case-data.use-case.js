import {
  findSeriesMembers,
  findStoredCase,
  findStoredCaseDocument,
} from "../../cases/repositories/case.repository.js";
import { findByCaseRef } from "../../cases/repositories/case-series.repository.js";
import { DOCUMENT_INCLUDE } from "../../cases/repositories/case/admin-case-query.js";
import {
  hasMembers,
  toCaseSummary,
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

const NOT_ASKED = undefined;

// The document read's answer: NOT_ASKED without include=document, null when
// the case has gone, or its size and document, null past RAW_CAP_BYTES.
const findDocumentOf = (key, include) =>
  include === DOCUMENT_INCLUDE ? findStoredCaseDocument(key) : NOT_ASKED;

// Without the document, the summary's size alone.
const sizeAndDocumentOf = (doc, stored) =>
  stored === NOT_ASKED ? { storedBytes: doc.storedBytes } : stored;

// The summary is read whatever is included; the document is a second read,
// of its own bytes.
const viewCaseData = async ({ workflowCode, caseRef, include }) => {
  const key = { workflowCode, caseRef };
  const [doc, stored, { series, memberDocs }] = await Promise.all([
    findStoredCase(key),
    findDocumentOf(key, include),
    findSeriesOf(key),
  ]);

  if (!doc || stored === null) {
    throw caseNotFound();
  }

  const answer = sizeAndDocumentOf(doc, stored);

  logger.info(`Read case document: ${answer.storedBytes} bytes`);

  const summary = toCaseSummary(doc, series, memberDocs);

  return {
    case: { ...summary, names: await findNamesOf(workflowCode, summary) },
    ...answer,
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
