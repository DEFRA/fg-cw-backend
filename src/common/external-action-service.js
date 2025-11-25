import { callExternalEndpoint } from "./external-endpoint-client.js";
import { logger } from "./logger.js";
import { extractEndpointParameters } from "./parameter-resolver.js";
import { findEndpoint, findExternalAction } from "./workflow-helpers.js";

/**
 * Calls an external API and fetches data based on an action value.
 */
export const callAPIAndFetchData = async ({
  actionValue,
  caseWorkflowContext,
  throwOnError = false,
}) => {
  try {
    logger.info(
      { actionValue },
      `Starting external service call for action: ${actionValue}`,
    );

    const externalAction = validateExternalAction(
      actionValue,
      caseWorkflowContext.workflow,
    );

    const endpoint = validateEndpoint(
      externalAction.endpoint.code,
      caseWorkflowContext.workflow,
    );

    const params = await extractEndpointParameters({
      actionValue,
      caseWorkflowContext,
    });

    const response = await callExternalEndpoint(
      endpoint,
      params,
      caseWorkflowContext,
      throwOnError,
    );

    return handleResponse(response, endpoint.code, actionValue);
  } catch (error) {
    return handleError(error, actionValue, throwOnError);
  }
};

const validateExternalAction = (actionValue, workflow) => {
  const externalAction = findExternalAction(actionValue, workflow);

  if (!externalAction?.endpoint?.code) {
    logger.warn(
      { actionValue },
      `No endpoint defined for action: ${actionValue}`,
    );
    throw new Error(`No endpoint defined for action: ${actionValue}`);
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

const handleResponse = (response, endpointCode, actionValue) => {
  if (!response) {
    logger.warn(
      { endpoint: endpointCode },
      `No response from external endpoint: ${endpointCode}`,
    );
    return {};
  }

  logger.info(
    { actionValue, endpoint: endpointCode },
    `Successfully fetched data from external service for action: ${actionValue}`,
  );

  return response;
};

const handleError = (error, actionValue, throwOnError) => {
  logger.error(
    { error, actionValue },
    `Failed to fetch data for action ${actionValue}: ${error.message}`,
  );

  if (throwOnError) {
    throw error;
  }

  return {};
};
