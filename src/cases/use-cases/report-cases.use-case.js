import { logger } from "../../common/logger.js";
import { countByPosition } from "../repositories/case.repository.js";
import { createRoleFilter } from "./find-cases.use-case.js";
import { findWorkflowsUseCase } from "./find-workflows.use-case.js";

const positionKey = (phaseCode, stageCode, statusCode) =>
  [phaseCode, stageCode, statusCode].join(":");

const sumCounts = (items) =>
  items.reduce((total, item) => total + item.count, 0);

// --- Tree built from the workflow definition (natural lifecycle order) -------
// Only positions that actually hold cases are included; subtotals roll up from
// their children.

const buildStatusRow = (phaseCode, stageCode, status, countMap) => {
  const key = positionKey(phaseCode, stageCode, status.code);
  const count = countMap.get(key) ?? 0;

  return count > 0
    ? { key, code: status.code, name: status.name, theme: status.theme, count }
    : null;
};

const buildDefinedStage = (phaseCode, stage, countMap, consumed) => {
  const rows = stage.statuses
    .map((status) => buildStatusRow(phaseCode, stage.code, status, countMap))
    .filter(Boolean);

  if (!rows.length) {
    return null;
  }

  rows.forEach((row) => consumed.add(row.key));

  return {
    code: stage.code,
    name: stage.name,
    count: sumCounts(rows),
    statuses: rows.map(({ code, name, theme, count }) => ({
      code,
      name,
      theme,
      count,
    })),
  };
};

const buildDefinedPhase = (phase, countMap, consumed) => {
  const stages = phase.stages
    .map((stage) => buildDefinedStage(phase.code, stage, countMap, consumed))
    .filter(Boolean);

  if (!stages.length) {
    return null;
  }

  return {
    code: phase.code,
    name: phase.name,
    count: sumCounts(stages),
    stages,
  };
};

const buildDefinedPhases = (workflow, countMap, consumed) =>
  workflow.phases
    .map((phase) => buildDefinedPhase(phase, countMap, consumed))
    .filter(Boolean);

// --- Orphans -----------------------------------------------------------------
// Cases whose stored position no longer exists in the workflow definition
// (e.g. a renamed or removed code) are surfaced under their raw codes rather
// than silently dropped, so the totals always reconcile.

const addOrphan = (phaseMap, c) => {
  if (!phaseMap.has(c.phaseCode)) {
    phaseMap.set(c.phaseCode, new Map());
  }
  const stageMap = phaseMap.get(c.phaseCode);

  if (!stageMap.has(c.stageCode)) {
    stageMap.set(c.stageCode, []);
  }
  stageMap.get(c.stageCode).push({
    code: c.statusCode,
    name: c.statusCode,
    theme: null,
    count: c.count,
  });
};

const groupOrphans = (counts, consumed) => {
  const phaseMap = new Map();

  for (const c of counts) {
    if (!consumed.has(positionKey(c.phaseCode, c.stageCode, c.statusCode))) {
      addOrphan(phaseMap, c);
    }
  }

  return phaseMap;
};

const toOrphanStage = ([stageCode, statuses]) => ({
  code: stageCode,
  name: stageCode,
  count: sumCounts(statuses),
  statuses,
});

const toOrphanPhase = ([phaseCode, stageMap]) => {
  const stages = [...stageMap.entries()].map(toOrphanStage);

  return { code: phaseCode, name: phaseCode, count: sumCounts(stages), stages };
};

const buildOrphanPhases = (counts, consumed) =>
  [...groupOrphans(counts, consumed).entries()].map(toOrphanPhase);

export const buildReport = (workflow, counts) => {
  const countMap = new Map(
    counts.map((c) => [
      positionKey(c.phaseCode, c.stageCode, c.statusCode),
      c.count,
    ]),
  );

  const consumed = new Set();
  const phases = [
    ...buildDefinedPhases(workflow, countMap, consumed),
    ...buildOrphanPhases(counts, consumed),
  ];

  return {
    total: sumCounts(phases),
    phases,
  };
};

const selectCaseType = (query, availableCaseTypes) => {
  if (query.workflowCode && availableCaseTypes.includes(query.workflowCode)) {
    return query.workflowCode;
  }

  return availableCaseTypes[0] ?? null;
};

export const reportCasesUseCase = async ({ user, query }) => {
  const roleFilter = createRoleFilter(user.getRoles());
  const workflows = await findWorkflowsUseCase(roleFilter);

  const availableCaseTypes = workflows
    .map((w) => w.code)
    .sort((a, b) => a.localeCompare(b));

  const selectedCaseType = selectCaseType(query, availableCaseTypes);

  if (!selectedCaseType) {
    return { selectedCaseType: null, availableCaseTypes, total: 0, phases: [] };
  }

  logger.info(`Building case report for workflow "${selectedCaseType}"`);

  const workflow = workflows.find((w) => w.code === selectedCaseType);
  const counts = await countByPosition([selectedCaseType]);

  return {
    selectedCaseType,
    availableCaseTypes,
    ...buildReport(workflow, counts),
  };
};
