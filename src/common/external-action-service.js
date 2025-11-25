import { callExternalEndpoint } from "./external-endpoint-client.js";
import { logger } from "./logger.js";
import { extractEndpointParameters } from "./parameter-resolver.js";
import { findEndpoint, findExternalAction } from "./workflow-helpers.js";

/**
 * Calls an external API and fetches data based on an action value.
 */
export const callAPIAndFetchData = async ({
  actionCode,
  caseWorkflowContext,
  throwOnError = false,
}) => {
  try {
    logger.info(
      { actionCode },
      `Starting external service call for action: ${actionCode}`,
    );

    const externalAction = validateExternalAction(
      actionCode,
      caseWorkflowContext.workflow,
    );

    const endpoint = validateEndpoint(
      externalAction.endpoint.code,
      caseWorkflowContext.workflow,
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

    return handleResponse(response, endpoint.code, actionCode);
  } catch (error) {
    return handleError(error, actionCode, throwOnError);
  }
};

const validateExternalAction = (actionCode, workflow) => {
  const externalAction = findExternalAction(actionCode, workflow);

  if (!externalAction?.endpoint?.code) {
    logger.warn(
      { actionCode },
      `No endpoint defined for action: ${actionCode}`,
    );
    throw new Error(`No endpoint defined for action: ${actionCode}`);
  }

  return externalAction;
};

const validateEndpoint = (endpointCode, workflow) => {
  const endpoint = findEndpoint(endpointCode, workflow);

  if (!endpoint) {
    logger.warn({ endpointCode }, `Endpoint not found: ${endpointCode}`);
    throw new Error(`Endpoint not found: ${endpointCode}`);
  }

  return endpoint;
};

const handleResponse = (response, endpoint, actionCode) => {
  if (!response) {
    logger.warn(
      { endpoint },
      `No response from external endpoint: ${endpoint}`,
    );
    return {};
  }

  logger.info(
    { actionCode, endpoint },
    `Successfully fetched data from external service for action: ${actionCode}`,
  );

  return response;
};

const handleError = (error, actionCode, throwOnError) => {
  logger.error(
    { error, actionCode },
    `Failed to fetch data for action ${actionCode}: ${error.message}`,
  );

  if (throwOnError) {
    throw error;
  }

  return {};
};
