import Boom from "@hapi/boom";
import { WorkflowDefinitionFetch } from "../../cases/models/workflow-definition-fetch.js";
import { findByGrantCodeAndVersion } from "../../cases/repositories/config-version.repository.js";
import { Workflow } from "../../cases/models/workflow.js";
import {
  findStoredVersions,
  saveFromDefinition,
} from "../../cases/repositories/workflow.repository.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSystemSecurityContext } from "../../common/audit-security-context.js";
import { logger } from "../../common/logger.js";
import { fetchConfigFile, S3FetchError } from "../../common/s3-client.js";
import { withAudit } from "../../common/with-audit.js";
import { workflowVersionNotFound } from "./view-workflow-version.use-case.js";

const HTTP_CONFLICT = 409;
const HTTP_SERVER_ERROR = 500;

const isFetchFailure = (error) =>
  error instanceof S3FetchError ||
  (error.isBoom && error.output.statusCode < HTTP_SERVER_ERROR);

const toFailure = (error) => {
  if (!isFetchFailure(error)) {
    throw error;
  }

  return WorkflowDefinitionFetch.fromError(error);
};

// A workflow is stored under its definition's own code, so another code would
// store a different workflow and leave this version without one.
const assertForGrant = (definition, grantCode) => {
  if (typeof definition?.code === "string" && definition.code !== grantCode) {
    throw Boom.badData(
      `Definition is for "${definition.code}", not "${grantCode}"`,
    );
  }
};

// With the code checked, a duplicate key is this version, stored meanwhile.
const store = async (definition, version) => {
  try {
    await saveFromDefinition(definition, version);
  } catch (error) {
    if (error.output?.statusCode !== HTTP_CONFLICT) {
      throw error;
    }
  }
};

const fetchAndStore = async ({ grantCode, version, s3Bucket, s3Key }) => {
  if (!s3Bucket || !s3Key) {
    return WorkflowDefinitionFetch.failed({ reason: "missing" });
  }

  try {
    const definition = await fetchConfigFile(s3Bucket, s3Key);

    assertForGrant(definition, grantCode);
    Workflow.fromDefinition(definition, version);
    await store(definition, version);

    return WorkflowDefinitionFetch.stored();
  } catch (error) {
    return toFailure(error);
  }
};

// Never touches the config version record: its fetch status is the lazy
// fetch's own, and an operator's fetch leaves it as it is.
const fetchWorkflowDefinition = async ({ grantCode, version }) => {
  const row = await findByGrantCodeAndVersion(grantCode, version);

  if (!row) {
    throw workflowVersionNotFound();
  }

  const storedVersions = await findStoredVersions(grantCode, [version]);

  if (storedVersions.has(version)) {
    return { files: [] };
  }

  const file = await fetchAndStore(row);

  logger.info(
    `Fetched workflow definition for ${grantCode}@${version}: ${file.outcome}`,
  );

  return { files: [{ ...file }] };
};

// GAS audits the operator's request; this audits what this service changed.
export const fetchWorkflowDefinitionAuditBuilder = (
  [{ grantCode, version, by, caller }],
  result,
) => ({
  entities: [
    {
      entity: auditEntities.WORKFLOW,
      action: auditActions.FETCH_CONFIG_DEFINITION,
      entityid: grantCode,
    },
  ],
  details: {
    security: buildSystemSecurityContext(),
    fetch: {
      grantCode,
      version,
      actor: by,
      caller: caller ?? null,
      files: result?.files ?? null,
    },
  },
  security: buildAuditSecurity(auditActions.FETCH_CONFIG_DEFINITION),
  segregationRef: `fetch-definition-${grantCode}`,
});

export const fetchWorkflowDefinitionUseCase = withAudit(
  fetchWorkflowDefinition,
  fetchWorkflowDefinitionAuditBuilder,
);
