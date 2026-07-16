import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { parseSemver } from "../../common/semver.js";
import { updateCurrentConfigVersion } from "../repositories/case.repository.js";
import { findLatestForMajor } from "../repositories/config-version.repository.js";
import {
  findByCode,
  findByCodeAndVersion,
} from "../repositories/workflow.repository.js";
import { resolveAndFetchWorkflowUseCase } from "./resolve-and-fetch-workflow.use-case.js";

// Process-level cache of immutable workflow definitions keyed by `${code}@${version}`.
// Safe to cache indefinitely: a (code, version) definition never changes.
const MAX_CACHE_ENTRIES = 100;
const definitionCache = new Map();

const cacheKey = (code, version) => `${code}@${version}`;

const getCachedDefinition = (code, version) =>
  definitionCache.get(cacheKey(code, version));

const setCachedDefinition = (code, version, workflow) => {
  if (!version || !workflow) {
    return;
  }
  // Simple bounded FIFO eviction.
  if (definitionCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = definitionCache.keys().next().value;
    definitionCache.delete(oldestKey);
  }
  definitionCache.set(cacheKey(code, version), workflow);
};

const parseMajor = (version) => {
  const parsed = parseSemver(version);
  if (!parsed) {
    throw Boom.badRequest(`Invalid semver version: ${version}`);
  }
  return parsed.major;
};

// Lazy: serve the immutable definition from the process cache, else pull it from
// the DB/S3 via resolveAndFetchWorkflowUseCase and cache it.
const loadDefinition = async (workflowCode, resolvedVersion) => {
  const cached = getCachedDefinition(workflowCode, resolvedVersion);
  if (cached) {
    return cached;
  }
  const { workflow } = await resolveAndFetchWorkflowUseCase(
    workflowCode,
    resolvedVersion,
  );
  setCachedDefinition(workflowCode, resolvedVersion, workflow);
  return workflow;
};

const logRollForward = (workflowCode, pinnedVersion, resolvedVersion) => {
  if (resolvedVersion !== pinnedVersion) {
    // Observability: a case has rolled forward to a newer config version.
    logger.info(
      `Config version roll-forward for workflow ${workflowCode}: ${pinnedVersion} -> ${resolvedVersion}`,
    );
  }
};

const resolveRolledForward = async (workflowCode, pinnedVersion, major) => {
  const configVersion = await findLatestForMajor(workflowCode, major);
  if (!configVersion) {
    throw Boom.notFound(
      `No active config version found for ${workflowCode}@${major}.x`,
    );
  }
  const resolvedVersion = configVersion.version;
  const workflow = await loadDefinition(workflowCode, resolvedVersion);
  logRollForward(workflowCode, pinnedVersion, resolvedVersion);
  return { workflow, resolvedVersion };
};

const memoResolve = async (memo, key, produce) => {
  if (memo?.has(key)) {
    return memo.get(key);
  }
  const result = await produce();
  memo?.set(key, result);
  return result;
};

// Resolves the latest active workflow within the same major as the pinned version.
export const resolveCurrentWorkflowUseCase = async (
  workflowCode,
  pinnedVersion,
  memo,
) => {
  if (!pinnedVersion) {
    return { workflow: await findByCode(workflowCode), resolvedVersion: null };
  }

  const major = parseMajor(pinnedVersion);
  const key = cacheKey(workflowCode, major);
  return memoResolve(memo, key, () =>
    resolveRolledForward(workflowCode, pinnedVersion, major),
  );
};

export const pinnedVersionOf = (kase) =>
  kase.currentConfigVersion ?? kase.originalConfigVersion;

const isRollForward = (pinnedVersion, resolvedVersion) =>
  Boolean(pinnedVersion) &&
  Boolean(resolvedVersion) &&
  resolvedVersion !== pinnedVersion;

const fallbackToPinned = async (kase, resolution, err) => {
  const pinnedVersion = pinnedVersionOf(kase);
  // Safety-net: the rolled-forward definition cannot locate the case's current
  // position. Fall back to the pinned version.
  logger.warn(
    `Config version fallback for workflow ${kase.workflowCode}: position ${kase.position} not found in ${resolution.resolvedVersion}, using pinned ${pinnedVersion}: ${err.message}`,
  );
  const pinnedWorkflow =
    getCachedDefinition(kase.workflowCode, pinnedVersion) ??
    (await findByCodeAndVersion(kase.workflowCode, pinnedVersion));

  if (!pinnedWorkflow) {
    // Pinned definition unavailable; best-effort with the rolled-forward one.
    return resolution;
  }

  setCachedDefinition(kase.workflowCode, pinnedVersion, pinnedWorkflow);
  return { workflow: pinnedWorkflow, resolvedVersion: pinnedVersion };
};

const verifyOrFallback = async (kase, resolution) => {
  try {
    resolution.workflow.getStage(kase.position);
    return resolution;
  } catch (err) {
    return fallbackToPinned(kase, resolution, err);
  }
};

// Resolves the workflow for a case, falling back to the pinned version if the
// rolled-forward definition is incompatible with the case's current position.
export const resolveWorkflowForCase = async (kase, memo) => {
  const pinned = pinnedVersionOf(kase);
  const resolution = await resolveCurrentWorkflowUseCase(
    kase.workflowCode,
    pinned,
    memo,
  );

  if (!isRollForward(pinned, resolution.resolvedVersion)) {
    return resolution;
  }
  if (!kase.position) {
    return resolution;
  }

  return verifyOrFallback(kase, resolution);
};

export const persistResolvedVersion = async (kase, resolvedVersion) => {
  if (resolvedVersion && resolvedVersion !== kase.currentConfigVersion) {
    await updateCurrentConfigVersion(kase._id, resolvedVersion);
    kase.currentConfigVersion = resolvedVersion;
  }
};

// Exposed for tests.
export const __clearDefinitionCache = () => definitionCache.clear();
