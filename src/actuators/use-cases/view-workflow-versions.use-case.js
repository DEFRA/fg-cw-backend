import {
  findAllForCode,
  findCurrent,
} from "../../cases/repositories/config-version.repository.js";
import { findStoredVersions } from "../../cases/repositories/workflow.repository.js";
import { toIsoOrNull } from "../../common/date-helpers.js";
import { notFoundWithReason } from "../../common/not-found-with-reason.js";

export const WORKFLOW_NOT_FOUND = "WORKFLOW_NOT_FOUND";

const workflowNotFound = () =>
  notFoundWithReason("Workflow not found", WORKFLOW_NOT_FOUND);

export const toVersionEntry = (
  { version, status, receivedAt, fetchStatus },
  storedVersions,
) => ({
  version,
  status,
  receivedAt: toIsoOrNull(receivedAt),
  fetchStatus,
  stored: storedVersions.has(version),
});

export const versionsOf = (rows) => rows.map(({ version }) => version);

export const toVersions = (rows, current, storedVersions) => ({
  current: current?.version ?? null,
  versions: rows.map((row) => toVersionEntry(row, storedVersions)),
});

export const viewWorkflowVersionsUseCase = async ({ code }) => {
  const [rows, current] = await Promise.all([
    findAllForCode(code),
    findCurrent(code),
  ]);

  if (rows.length === 0) {
    throw workflowNotFound();
  }

  const storedVersions = await findStoredVersions(code, versionsOf(rows));

  return { code, ...toVersions(rows, current, storedVersions) };
};
