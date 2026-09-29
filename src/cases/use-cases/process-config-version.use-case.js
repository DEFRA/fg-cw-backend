import Boom from "@hapi/boom";
import { config } from "../../common/config.js";
import { getConfigurationVariant } from "../../common/configuration-variant.js";
import { logger } from "../../common/logger.js";
import {
  fetchConfigFile,
  findS3KeyInManifest,
  S3FetchError,
} from "../../common/s3-client.js";
import { parseSemver } from "../../common/semver.js";
import { markPermanentFailure } from "../../events/retryable.js";
import { ConfigVersion } from "../models/config-version.js";
import { upsert } from "../repositories/config-version.repository.js";
import { checkWorkflowDefinition } from "./check-workflow-definition.js";

const VALID_STATUSES = ["active", "draft"];

// eslint-disable-next-line complexity
const validateEventData = (eventData) => {
  const { grantCode, version, status, manifest, s3Bucket } = eventData;

  if (!grantCode || !version) {
    throw Boom.badRequest(
      `Config version event missing required fields: grantCode=${grantCode}, version=${version}`,
    );
  }

  if (!s3Bucket) {
    throw Boom.badRequest(
      `Config version event for ${grantCode}@${version} has no bucket (path attribute)`,
    );
  }

  if (!status || !VALID_STATUSES.includes(status)) {
    throw Boom.badRequest(
      `Config version event has invalid status: "${status}" (expected one of: ${VALID_STATUSES.join(", ")})`,
    );
  }

  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw Boom.badRequest(
      "Config version event missing required field: manifest (expected a non-empty array)",
    );
  }

  const parsed = parseSemver(version);
  if (!parsed) {
    throw Boom.badRequest(`Invalid semver version in config event: ${version}`);
  }
};

// Every Boom on this path is a bad message or a definition that will not build,
// both exactly as bad next time.
const isPermanentFailure = (error) => {
  if (Boom.isBoom(error)) {
    return true;
  }

  if (error instanceof S3FetchError) {
    return error.isPermanent || error.isParseError;
  }

  return error instanceof TypeError;
};

const applyConfigVersion = async (eventData) => {
  const { grantCode, version, status, manifest, s3Bucket } = eventData;

  validateEventData(eventData);

  logger.info(`Processing config version: ${grantCode}@${version} (${status})`);

  const variant = getConfigurationVariant(config);
  const s3Key = findS3KeyInManifest(manifest, "cw", variant);

  // Checked before the version is recorded, so a definition no case can use
  // never becomes one a case resolves to.
  const definition = await fetchConfigFile(s3Bucket, s3Key);
  checkWorkflowDefinition(definition, { grantCode, version });

  const configVersion = ConfigVersion.new({
    grantCode,
    version,
    status,
    s3Key,
    s3Bucket,
  });

  await upsert(configVersion);

  logger.info(
    `Finished: Processing config version: ${grantCode}@${version} (s3Key: ${s3Key})`,
  );
};

const logRejection = ({ grantCode, version }, error) => {
  const reference = `${grantCode}@${version}`;

  logger.error(
    {
      event: {
        action: "config-version-rejected",
        outcome: "failure",
        reference,
        reason: error.message,
      },
    },
    `Config version ${reference} rejected and dead-lettered: ${error.name}: ${error.message}`,
  );
};

export const processConfigVersionUseCase = async ({ event }) => {
  const eventData = { ...event.data };

  try {
    await applyConfigVersion(eventData);
  } catch (error) {
    if (!isPermanentFailure(error)) {
      throw error;
    }

    logRejection(eventData, error);
    throw markPermanentFailure(error);
  }
};
