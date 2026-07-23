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
    return { workflow: cached, definitionSource: "cache" };
  }
  const { workflow, definitionSource } = await resolveAndFetchWorkflowUseCase(
    workflowCode,
    resolvedVersion,
  );
  setCachedDefinition(workflowCode, resolvedVersion, workflow);
  return { workflow, definitionSource };
};

const resolveRolledForward = async (workflowCode, major) => {
  const configVersion = await findLatestForMajor(workflowCode, major);
  if (!configVersion) {
    throw Boom.notFound(
      `No active config version found for ${workflowCode}@${major}.x`,
    );
  }
  const resolvedVersion = configVersion.version;
  const { workflow, definitionSource } = await loadDefinition(
    workflowCode,
    resolvedVersion,
  );
  return { workflow, resolvedVersion, definitionSource };
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
    return {
      workflow: await findByCode(workflowCode),
      resolvedVersion: null,
      definitionSource: "mongodb",
    };
  }

  const major = parseMajor(pinnedVersion);
  const key = cacheKey(workflowCode, major);
  return memoResolve(memo, key, () =>
    resolveRolledForward(workflowCode, major),
  );
};

export const pinnedVersionOf = (kase) =>
  kase.currentConfigVersion ?? kase.originalConfigVersion;

const isRollForward = (pinnedVersion, resolvedVersion) =>
  Boolean(pinnedVersion) &&
  Boolean(resolvedVersion) &&
  resolvedVersion !== pinnedVersion;

// Safety-net: the rolled-forward definition cannot locate the case's current
// position. Fall back to the pinned version.
const fallbackToPinned = async (kase, resolution, err) => {
  const pinnedVersion = pinnedVersionOf(kase);
  logger.warn(
    `Config version fallback for workflow ${kase.workflowCode}: position ${kase.position} not found in ${resolution.resolvedVersion}, using pinned ${pinnedVersion}: ${err.message}`,
  );

  const cached = getCachedDefinition(kase.workflowCode, pinnedVersion);
  if (cached) {
    setCachedDefinition(kase.workflowCode, pinnedVersion, cached);
    return {
      workflow: cached,
      resolvedVersion: pinnedVersion,
      definitionSource: "cache",
    };
  }

  const pinnedWorkflow = await findByCodeAndVersion(
    kase.workflowCode,
    pinnedVersion,
  );

  if (!pinnedWorkflow) {
    // Pinned definition unavailable; best-effort with the rolled-forward one.
    return resolution;
  }

  setCachedDefinition(kase.workflowCode, pinnedVersion, pinnedWorkflow);
  return {
    workflow: pinnedWorkflow,
    resolvedVersion: pinnedVersion,
    definitionSource: "mongodb",
  };
};

const verifyOrFallback = async (kase, resolution) => {
  try {
    resolution.workflow.getStage(kase.position);
    return { ...resolution, didFallback: false };
  } catch (err) {
    const fallback = await fallbackToPinned(kase, resolution, err);
    // Only true when the pinned definition was actually used; when the pinned
    // workflow is unavailable, fallbackToPinned returns the rolled-forward
    // resolution and this should not be reported as a fallback.
    const didFallback = fallback.resolvedVersion === pinnedVersionOf(kase);
    return { ...fallback, didFallback };
  }
};

const determineResolutionType = (pinned, resolvedVersion, didFallback) => {
  if (!pinned) {
    return "legacy";
  }
  if (didFallback) {
    return "fallback";
  }
  if (resolvedVersion !== pinned) {
    return "roll-forward";
  }
  return "version-match";
};

const logWorkflowResolved = (kase, resolvedVersion, resolution) => {
  logger.info(
    {
      event: {
        action: "case-workflow-resolved",
        outcome: "success",
      },
      case: {
        id: kase._id,
        reference: kase.caseRef,
      },
      workflow: {
        code: kase.workflowCode,
        originalConfigVersion: kase.originalConfigVersion,
        resolvedConfigVersion: resolvedVersion,
        resolutionType: resolution.resolutionType,
        definitionSource: resolution.definitionSource,
      },
    },
    "Resolved workflow configuration for case",
  );
};

const logWorkflowResolutionFailure = (kase, requestedVersion, err) => {
  logger.error(
    {
      event: {
        action: "case-workflow-resolved",
        outcome: "failure",
      },
      case: {
        id: kase._id,
        reference: kase.caseRef,
      },
      workflow: {
        code: kase.workflowCode,
        originalConfigVersion: kase.originalConfigVersion,
        requestedVersion,
        resolvedConfigVersion: null,
      },
      error: { message: err.message },
    },
    "Failed to resolve workflow configuration for case",
  );
};

// Resolves the workflow version for a case then verifies it is compatible with
// the case's current position, falling back to the pinned version if not.
const resolveWithFallback = async (kase, pinned, memo) => {
  const resolution = await resolveCurrentWorkflowUseCase(
    kase.workflowCode,
    pinned,
    memo,
  );

  if (!resolution.workflow) {
    throw Boom.notFound(`Workflow with code "${kase.workflowCode}" not found`);
  }

  if (!isRollForward(pinned, resolution.resolvedVersion) || !kase.position) {
    return { ...resolution, didFallback: false };
  }

  return verifyOrFallback(kase, resolution);
};

// Resolves the workflow for a case, falling back to the pinned version if the
// rolled-forward definition is incompatible with the case's current position.
export const resolveWorkflowForCase = async (kase, memo) => {
  const pinned = pinnedVersionOf(kase);

  try {
    const { workflow, resolvedVersion, definitionSource, didFallback } =
      await resolveWithFallback(kase, pinned, memo);

    const resolutionType = determineResolutionType(
      pinned,
      resolvedVersion,
      didFallback,
    );

    const result = {
      workflow,
      resolvedVersion,
      definitionSource,
      resolutionType,
    };

    logWorkflowResolved(kase, resolvedVersion, result);

    return result;
  } catch (err) {
    logWorkflowResolutionFailure(kase, pinned, err);
    throw err;
  }
};

export const persistResolvedVersion = async (kase, resolvedVersion) => {
  if (resolvedVersion && resolvedVersion !== kase.currentConfigVersion) {
    await updateCurrentConfigVersion(kase._id, resolvedVersion);
    kase.currentConfigVersion = resolvedVersion;
  }
};

// Exposed for tests.
export const __clearDefinitionCache = () => definitionCache.clear();
