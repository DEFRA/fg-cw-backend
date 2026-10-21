import { orNull } from "../../cases/repositories/actuator-box.repository.js";
import { DOCUMENT_INCLUDE } from "../../cases/repositories/case/admin-case-query.js";
import { toStoredDocument } from "../../cases/repositories/case/admin-case-row.js";
import {
  findAllForCode,
  findCurrent,
} from "../../cases/repositories/config-version.repository.js";
import { toWorkflowSummary } from "../../cases/repositories/workflow/admin-workflow-row.js";
import { findStoredWorkflowRow } from "../../cases/repositories/workflow.repository.js";
import { notFoundWithReason } from "../../common/not-found-with-reason.js";
import { toServiceAddress } from "../../common/service-config-builder.js";
import {
  toVersionEntry,
  toVersions,
} from "./view-workflow-versions.use-case.js";

export const WORKFLOW_VERSION_NOT_FOUND = "WORKFLOW_VERSION_NOT_FOUND";

export const workflowVersionNotFound = () =>
  notFoundWithReason("Workflow version not found", WORKFLOW_VERSION_NOT_FOUND);

// One per endpoint, in the workflow's order: callers find them by position.
const toAddresses = (endpoints) =>
  (endpoints ?? []).map(({ code, service, path }) => ({
    code: orNull(code),
    service: orNull(service),
    url: toServiceAddress({ service, path }),
  }));

const toDocumentParts = (doc, include) =>
  include === DOCUMENT_INCLUDE
    ? {
        document: doc && toStoredDocument(doc),
        addresses: toAddresses(doc?.endpoints),
      }
    : {};

const toStoredParts = (doc) =>
  doc
    ? { storedBytes: doc.storedBytes, summary: toWorkflowSummary(doc) }
    : { storedBytes: null, summary: null };

const findRow = (rows, version) => {
  const row = rows.find((candidate) => candidate.version === version);

  if (!row) {
    throw workflowVersionNotFound();
  }

  return row;
};

export const viewWorkflowVersionUseCase = async ({
  code,
  version,
  include,
}) => {
  const [rows, current, doc] = await Promise.all([
    findAllForCode(code),
    findCurrent(code),
    findStoredWorkflowRow({ code, version }, include),
  ]);

  const row = findRow(rows, version);

  return {
    version: {
      grantCode: row.grantCode,
      ...toVersionEntry(row),
      fetchStatus: row.fetchStatus,
    },
    ...toVersions(rows, current),
    ...toStoredParts(doc),
    ...toDocumentParts(doc, include),
  };
};
