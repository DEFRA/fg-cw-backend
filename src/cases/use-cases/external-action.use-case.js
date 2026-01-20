import Boom from "@hapi/boom";
import { AccessControl } from "../../common/access-control.js";
import { callExternalEndpoint } from "../../common/external-endpoint-client.js";
import { logger } from "../../common/logger.js";
import { extractEndpointParameters } from "../../common/parameter-resolver.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { RequiredAppRoles } from "../models/required-app-roles.js";

export const externalActionUseCase = async ({
  actionCode,
  caseWorkflowContext,
  throwOnError = false,
}) => {
  authoriseExternalAction(caseWorkflowContext);

  try {
    return await executeAction({
      actionCode,
      caseWorkflowContext,
      throwOnError,
    });
  } catch (error) {
    if (throwOnError) {
      throw error;
    }

    return {};
  }
};

const authoriseExternalAction = (caseWorkflowContext) => {
  AccessControl.authorise(caseWorkflowContext.user, {
    idpRoles: [IdpRoles.ReadWrite],
    appRoles:
      caseWorkflowContext.workflow.requiredRoles ?? RequiredAppRoles.None,
  });
};

const validateAction = (actionCode, workflow) => {
  const action = workflow.findExternalAction(actionCode);

  if (!action?.endpoint?.code) {
    throw Boom.notFound(`No endpoint defined for action: ${actionCode}`);
  }

  return action;
};

const validateEndpoint = (endpointCode, workflow) => {
  const endpoint = workflow.findEndpoint(endpointCode);

  if (!endpoint) {
    throw Boom.notFound(`Endpoint not found: ${endpointCode}`);
  }

  return endpoint;
};

const executeAction = async ({
  actionCode,
  caseWorkflowContext,
  throwOnError,
}) => {
  const action = validateAction(actionCode, caseWorkflowContext.workflow);
  const endpoint = validateEndpoint(
    action.endpoint.code,
    caseWorkflowContext.workflow,
  );

  logger.info(
    `Calling external endpoint: ${endpoint.code} for action: ${actionCode}`,
  );

  const params = await extractEndpointParameters({
    actionCode,
    caseWorkflowContext,
  });

  const response = await callExternalEndpoint(
    endpoint,
    params,
    caseWorkflowContext,
    throwOnError,
  );

  logger.info(
    `Finished: Calling external endpoint: ${endpoint.code} for action: ${actionCode}`,
  );

  return response || {};
};
