import Boom from "@hapi/boom";
import { FetchStatus } from "../../common/fetch-status.js";
import { logger } from "../../common/logger.js";
import { fetchConfigFile, S3FetchError } from "../../common/s3-client.js";
import { parseSemver } from "../../common/semver.js";
import {
  findLatestPatch,
  updateFetchStatus,
} from "../repositories/config-version.repository.js";
import {
  findByCodeAndVersion,
  saveFromDefinition,
} from "../repositories/workflow.repository.js";

const MAX_FETCH_ATTEMPTS = 5;
const HTTP_CONFLICT = 409;

const handleS3Error = async (err, grantCode, version) => {
  if (err.isPermanent || err.isParseError) {
    logger.error(
      `Permanent S3 fetch failure for ${grantCode}@${version} key=${err.key}: ${err.message}`,
    );
    await updateFetchStatus(
      grantCode,
      version,
      FetchStatus.PermanentError,
      err.message,
    );
    throw Boom.badGateway(
      `Permanent S3 error for ${grantCode}@${version}: ${err.message}`,
    );
  }

  logger.error(
    `Transient S3 fetch failure for ${grantCode}@${version} key=${err.key}: ${err.message}`,
  );
  await updateFetchStatus(
    grantCode,
    version,
    FetchStatus.TransientError,
    err.message,
  );
  throw Boom.serverUnavailable(
    `Transient S3 error for ${grantCode}@${version}: ${err.message}`,
  );
};

const guardFetchStatus = async (configVersion, grantCode, resolvedVersion) => {
  if (
    configVersion.fetchAttempts >= MAX_FETCH_ATTEMPTS &&
    configVersion.fetchStatus !== FetchStatus.PermanentError
  ) {
    logger.warn(
      `Max fetch attempts (${MAX_FETCH_ATTEMPTS}) exceeded for ${grantCode}@${resolvedVersion}`,
    );
    await updateFetchStatus(
      grantCode,
      resolvedVersion,
      FetchStatus.PermanentError,
      `Exceeded ${MAX_FETCH_ATTEMPTS} fetch attempts`,
    );
    throw Boom.badGateway(
      `Max fetch attempts exceeded for ${grantCode}@${resolvedVersion}`,
    );
  }

  if (configVersion.fetchStatus === FetchStatus.PermanentError) {
    logger.warn(
      `Permanent error recorded for ${grantCode}@${resolvedVersion}: ${configVersion.fetchError}`,
    );
    throw Boom.badGateway(
      `Permanent error for ${grantCode}@${resolvedVersion}: ${configVersion.fetchError}`,
    );
  }
};

const fetchFromS3 = async (configVersion, grantCode, resolvedVersion) => {
  try {
    return await fetchConfigFile(configVersion.s3Bucket, configVersion.s3Key);
  } catch (err) {
    if (err instanceof S3FetchError) {
      await handleS3Error(err, grantCode, resolvedVersion);
    }
    throw err;
  }
};

const saveOrFallback = async (
  workflowDefinition,
  grantCode,
  resolvedVersion,
) => {
  try {
    const workflow = await saveFromDefinition(
      workflowDefinition,
      resolvedVersion,
    );
    await updateFetchStatus(grantCode, resolvedVersion, FetchStatus.Fetched);
    return workflow;
  } catch (err) {
    if (err.isBoom && err.output.statusCode === HTTP_CONFLICT) {
      logger.info(
        `Concurrent insert for ${grantCode}@${resolvedVersion}, loading existing`,
      );
      return await findByCodeAndVersion(grantCode, resolvedVersion);
    }
    throw err;
  }
};

const fetchAndStoreWorkflow = async (
  configVersion,
  grantCode,
  resolvedVersion,
) => {
  logger.info(
    `Fetching workflow definition from S3 for ${grantCode}@${resolvedVersion}`,
  );

  const workflowDefinition = await fetchFromS3(
    configVersion,
    grantCode,
    resolvedVersion,
  );
  const workflow = await saveOrFallback(
    workflowDefinition,
    grantCode,
    resolvedVersion,
  );

  logger.info(
    `Finished: Resolved and stored ${grantCode}@${resolvedVersion} from S3`,
  );

  return workflow;
};

const findCachedWorkflow = async (
  configVersion,
  grantCode,
  resolvedVersion,
) => {
  if (configVersion.fetchStatus !== FetchStatus.Fetched) {
    return null;
  }

  const existingWorkflow = await findByCodeAndVersion(
    grantCode,
    resolvedVersion,
  );
  if (existingWorkflow) {
    logger.info(`Resolved ${grantCode}@${resolvedVersion} from cache`);
  }
  return existingWorkflow;
};

const resolveConfigVersion = async (grantCode, requestedVersion) => {
  const parsed = parseSemver(requestedVersion);
  if (!parsed) {
    throw Boom.badRequest(`Invalid semver version: ${requestedVersion}`);
  }

  const configVersion = await findLatestPatch(
    grantCode,
    parsed.major,
    parsed.minor,
  );

  if (!configVersion) {
    throw Boom.notFound(
      `No active config version found for ${grantCode}@${parsed.major}.${parsed.minor}`,
    );
  }

  return configVersion;
};

export const resolveAndFetchWorkflowUseCase = async (
  grantCode,
  requestedVersion,
) => {
  logger.info(`Resolving config version for ${grantCode}@${requestedVersion}`);

  const configVersion = await resolveConfigVersion(grantCode, requestedVersion);
  const resolvedVersion = configVersion.version;

  await guardFetchStatus(configVersion, grantCode, resolvedVersion);

  const cached = await findCachedWorkflow(
    configVersion,
    grantCode,
    resolvedVersion,
  );
  if (cached) {
    return { workflow: cached, resolvedVersion };
  }

  const workflow = await fetchAndStoreWorkflow(
    configVersion,
    grantCode,
    resolvedVersion,
  );

  return { workflow, resolvedVersion };
};
