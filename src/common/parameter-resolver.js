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

const PARAM_TYPES = new Set(["PATH", "BODY", "HEADERS"]);

const resolveEndpointParams = async (endpointParams, caseWorkflowContext) => {
  const params = createEmptyParams();

  for (const [paramType, paramMap] of Object.entries(endpointParams)) {
    if (!PARAM_TYPES.has(paramType)) {
      throw Boom.badRequest(
        `Unsupported endpoint parameter type: ${paramType}`,
      );
    }

    const resolvedParams = await resolveParameterMap({
      paramMap,
      caseWorkflowContext,
    });

    params[paramType] =
      paramType === "HEADERS" ? toHeaders(resolvedParams) : resolvedParams;
  }

  return params;
};

// Unlike a BODY value, a missing header changes what a request means (it often
// says who the call is for), so every header must resolve to a value. Values
// are never put in the error, as they can identify the caseworker.
const toHeaders = (resolvedParams) =>
  Object.fromEntries(
    Object.entries(resolvedParams).map(([name, value]) => [
      name,
      toHeaderValue(name, value),
    ]),
  );

const HEADER_VALUE_TYPES = new Set(["string", "number", "boolean"]);

const isEmpty = (value) =>
  value === undefined || value === null || value === "";

const toHeaderValue = (name, value) => {
  if (isEmpty(value)) {
    throw Boom.badRequest(`Header "${name}" resolved to no value`);
  }

  if (!HEADER_VALUE_TYPES.has(typeof value)) {
    throw Boom.badRequest(
      `Header "${name}" must resolve to a string, number or boolean`,
    );
  }

  return String(value);
};
