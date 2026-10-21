import {
  findAllForCode,
  findCurrent,
} from "../../cases/repositories/config-version.repository.js";
import { toIsoOrNull } from "../../common/date-helpers.js";
import { notFoundWithReason } from "../../common/not-found-with-reason.js";

export const WORKFLOW_NOT_FOUND = "WORKFLOW_NOT_FOUND";

const workflowNotFound = () =>
  notFoundWithReason("Workflow not found", WORKFLOW_NOT_FOUND);

export const toVersionEntry = ({ version, status, receivedAt }) => ({
  version,
  status,
  receivedAt: toIsoOrNull(receivedAt),
});

export const toVersions = (rows, current) => ({
  current: current?.version ?? null,
  versions: rows.map(toVersionEntry),
});

export const viewWorkflowVersionsUseCase = async ({ code }) => {
  const [rows, current] = await Promise.all([
    findAllForCode(code),
    findCurrent(code),
  ]);

  if (rows.length === 0) {
    throw workflowNotFound();
  }

  return { code, ...toVersions(rows, current) };
};
