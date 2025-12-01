import Boom from "@hapi/boom";
import { resolveJSONPath } from "./resolve-json.js";

/**
 * Resolves a parameter map by evaluating JSONPath expressions.
 */
export const resolveParameterMap = async ({
  paramMap,
  caseWorkflowContext,
}) => {
  const params = {};
  for (const [paramName, paramExpression] of Object.entries(paramMap)) {
    params[paramName] = await resolveJSONPath({
      root: caseWorkflowContext,
      path: paramExpression,
    });
  }
  return params;
};

/**
 * Extracts and resolves endpoint parameters from an external action.
 */
export const extractEndpointParameters = async ({
  actionCode,
  caseWorkflowContext,
}) => {
  const externalAction =
    caseWorkflowContext.workflow.findExternalAction(actionCode);

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
    BODY: {},
  };
};

const resolveEndpointParams = async (endpointParams, caseWorkflowContext) => {
  const params = createEmptyParams();

  for (const [paramType, paramMap] of Object.entries(endpointParams)) {
    if (paramType !== "PATH" && paramType !== "BODY") {
      throw Boom.badRequest(
        `Unsupported endpoint parameter type: ${paramType}`,
      );
    }

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
  } else if (paramType === "BODY") {
    params.BODY = resolvedParams;
  } else {
    throw Boom.badRequest(`Unsupported endpoint parameter type: ${paramType}`);
  }
};
