import Boom from "@hapi/boom";
import { FetchStatus } from "../../common/fetch-status.js";
import { logger } from "../../common/logger.js";
import { fetchConfigFile, S3FetchError } from "../../common/s3-client.js";
import { parseSemver } from "../../common/semver.js";
import {
  findLatestForMajor,
  updateFetchStatus,
} from "../repositories/config-version.repository.js";
import {
  findByCodeAndVersion,
  saveFromDefinition,
} from "../repositories/workflow.repository.js";

const MAX_FETCH_ATTEMPTS = 5;
const HTTP_CONFLICT = 409;

const handleS3Error = async (err, workflowCode, version) => {
  if (err.isPermanent || err.isParseError) {
    logger.error(
      err,
      `Permanent S3 fetch failure for ${workflowCode}@${version}`,
    );
    await updateFetchStatus(
      workflowCode,
      version,
      FetchStatus.PermanentError,
      err.message,
    );
    throw Boom.badGateway(
      `Permanent S3 error for ${workflowCode}@${version}: ${err.message}`,
    );
  }

  logger.error(
    err,
    `Transient S3 fetch failure for ${workflowCode}@${version}`,
  );
  await updateFetchStatus(
    workflowCode,
    version,
    FetchStatus.TransientError,
    err.message,
  );
  throw Boom.serverUnavailable(
    `Transient S3 error for ${workflowCode}@${version}: ${err.message}`,
  );
};

const guardFetchStatus = async (
  configVersion,
  workflowCode,
  resolvedVersion,
) => {
  if (
    configVersion.fetchAttempts >= MAX_FETCH_ATTEMPTS &&
    configVersion.fetchStatus !== FetchStatus.PermanentError
  ) {
    logger.warn(
      `Max fetch attempts (${MAX_FETCH_ATTEMPTS}) exceeded for ${workflowCode}@${resolvedVersion}`,
    );
    await updateFetchStatus(
      workflowCode,
      resolvedVersion,
      FetchStatus.PermanentError,
      `Exceeded ${MAX_FETCH_ATTEMPTS} fetch attempts`,
    );
    throw Boom.badGateway(
      `Max fetch attempts exceeded for ${workflowCode}@${resolvedVersion}`,
    );
  }

  if (configVersion.fetchStatus === FetchStatus.PermanentError) {
    logger.warn(
      `Permanent error recorded for ${workflowCode}@${resolvedVersion}: ${configVersion.fetchError}`,
    );
    throw Boom.badGateway(
      `Permanent error for ${workflowCode}@${resolvedVersion}: ${configVersion.fetchError}`,
    );
  }
};

const fetchFromS3 = async (configVersion, workflowCode, resolvedVersion) => {
  try {
    return await fetchConfigFile(configVersion.s3Bucket, configVersion.s3Key);
  } catch (err) {
    if (err instanceof S3FetchError) {
      await handleS3Error(err, workflowCode, resolvedVersion);
    }
    throw err;
  }
};

const saveOrFallback = async (
  workflowDefinition,
  workflowCode,
  resolvedVersion,
) => {
  try {
    await saveFromDefinition(workflowDefinition, resolvedVersion);
    await updateFetchStatus(workflowCode, resolvedVersion, FetchStatus.Fetched);
  } catch (err) {
    if (err.isBoom && err.output.statusCode === HTTP_CONFLICT) {
      logger.info(
        `Concurrent insert for ${workflowCode}@${resolvedVersion}, loading existing`,
      );
    } else {
      throw err;
    }
  }
  // Always reload from DB so the document is properly mapped to domain models
  // (the raw Workflow constructor does not hydrate sub-models like WorkflowPhase).
  return await findByCodeAndVersion(workflowCode, resolvedVersion);
};

const fetchAndStoreWorkflow = async (
  configVersion,
  workflowCode,
  resolvedVersion,
) => {
  logger.info(
    `Fetching workflow definition from S3 for ${workflowCode}@${resolvedVersion}`,
  );

  const workflowDefinition = await fetchFromS3(
    configVersion,
    workflowCode,
    resolvedVersion,
  );
  const workflow = await saveOrFallback(
    workflowDefinition,
    workflowCode,
    resolvedVersion,
  );

  logger.info(
    `Finished: Resolved and stored ${workflowCode}@${resolvedVersion} from S3`,
  );

  return workflow;
};

const findStoredWorkflow = async (
  configVersion,
  workflowCode,
  resolvedVersion,
) => {
  if (configVersion.fetchStatus !== FetchStatus.Fetched) {
    return null;
  }

  const existingWorkflow = await findByCodeAndVersion(
    workflowCode,
    resolvedVersion,
  );
  if (existingWorkflow) {
    logger.info(`Resolved ${workflowCode}@${resolvedVersion} from cache`);
  }
  return existingWorkflow;
};

const resolveConfigVersion = async (workflowCode, requestedVersion) => {
  const parsed = parseSemver(requestedVersion);
  if (!parsed) {
    throw Boom.badRequest(`Invalid semver version: ${requestedVersion}`);
  }

  // Roll forward to the latest active version within the same major.
  const configVersion = await findLatestForMajor(workflowCode, parsed.major);

  if (!configVersion) {
    throw Boom.notFound(
      `No active config version found for ${workflowCode}@${parsed.major}.x`,
    );
  }

  return configVersion;
};

export const resolveAndFetchWorkflowUseCase = async (
  workflowCode,
  requestedVersion,
) => {
  logger.info(
    `Resolving config version for ${workflowCode}@${requestedVersion}`,
  );

  const configVersion = await resolveConfigVersion(
    workflowCode,
    requestedVersion,
  );
  const resolvedVersion = configVersion.version;

  await guardFetchStatus(configVersion, workflowCode, resolvedVersion);

  const cached = await findStoredWorkflow(
    configVersion,
    workflowCode,
    resolvedVersion,
  );
  if (cached) {
    return { workflow: cached, resolvedVersion };
  }

  const workflow = await fetchAndStoreWorkflow(
    configVersion,
    workflowCode,
    resolvedVersion,
  );

  return { workflow, resolvedVersion };
};
