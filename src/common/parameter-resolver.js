import { logger } from "./logger.js";
import { resolveJSONPath } from "./resolve-json.js";
import { findExternalAction } from "./workflow-helpers.js";

/**
 * Resolves a parameter map by evaluating JSONPath expressions.
 */
export const resolveParameterMap = async ({
  paramMap,
  caseWorkflowContext,
}) => {
  const params = {};
  for (const [paramName, paramExpression] of Object.entries(paramMap)) {
    const resolvedValue = await resolveJSONPath({
      root: caseWorkflowContext,
      path: paramExpression,
    });

    logger.info(
      {
        paramName,
        paramExpression,
        resolvedValue,
        valueType: typeof resolvedValue,
      },
      `Resolved parameter: ${paramName}`,
    );

    params[paramName] = resolvedValue;
  }
  return params;
};

/**
 * Extracts and resolves endpoint parameters from an external action.
 */
export const extractEndpointParameters = async ({
  actionValue,
  caseWorkflowContext,
}) => {
  const externalAction = findExternalAction(
    actionValue,
    caseWorkflowContext.workflow,
  );

  if (!hasEndpointParams(externalAction)) {
    return createEmptyParams();
  }

  return await resolveEndpointParams(
    externalAction.endpoint.endpointParams,
    caseWorkflowContext,
  );
};

const hasEndpointParams = (externalAction) => {
  return externalAction?.endpoint?.endpointParams;
};

const createEmptyParams = () => {
  return {
    PATH: {},
    REQUEST: {},
  };
};

const resolveEndpointParams = async (endpointParams, caseWorkflowContext) => {
  const params = createEmptyParams();

  for (const [paramType, paramMap] of Object.entries(endpointParams)) {
    const resolvedParams = await resolveParameterMap({
      paramMap,
      caseWorkflowContext,
    });

    assignParamsByType(params, paramType, resolvedParams);
  }

  return params;
};

const assignParamsByType = (params, paramType, resolvedParams) => {
  if (paramType === "PATH") {
    params.PATH = resolvedParams;
  } else if (paramType === "REQUEST") {
    params.REQUEST = resolvedParams;
  } else {
    logger.warn(
      { paramType },
      `Unsupported endpoint parameter type: ${paramType}`,
    );
  }
};
