import Boom from "@hapi/boom";
import { findStoredCase } from "../../cases/repositories/case.repository.js";
import { findByCaseRef } from "../../cases/repositories/case-series.repository.js";
import { DOCUMENT_INCLUDE } from "../../cases/repositories/case/admin-case-query.js";
import {
  toCaseSummary,
  toStoredDocument,
} from "../../cases/repositories/case/admin-case-row.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildOperatorSecurityContext } from "../../common/audit-security-context.js";
import { auditedRead } from "../../common/audited-read.js";
import { logger } from "../../common/logger.js";

export const CASE_NOT_FOUND = "CASE_NOT_FOUND";

// The reason tells the caller a missing case from a missing route.
const caseNotFound = () => {
  const error = Boom.notFound("Case not found");

  error.output.payload.reason = CASE_NOT_FOUND;

  return error;
};

const viewCaseData = async ({ workflowCode, caseRef, include }) => {
  const [doc, [series]] = await Promise.all([
    findStoredCase({ workflowCode, caseRef }, include),
    findByCaseRef({ ref: caseRef, workflowCode }),
  ]);

  if (!doc) {
    throw caseNotFound();
  }

  logger.info(`Read case document: ${doc.storedBytes} bytes`);

  return {
    case: toCaseSummary(doc, series),
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
