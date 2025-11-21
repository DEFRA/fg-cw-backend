import Wreck from "@hapi/wreck";
import { resolveEndpoint } from "./endpoint-resolver.js";
import { logger } from "./logger.js";

const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 300;
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Calls an external endpoint defined in the workflow.
 */
export const callExternalEndpoint = async (
  endpoint,
  params,
  caseWorkflowContext,
) => {
  const resolvedParams = params ?? {};
  try {
    const { response, payload } = await executeRequest(
      endpoint,
      resolvedParams,
      caseWorkflowContext,
    );
    return handleResponse(endpoint, response, payload);
  } catch (error) {
    return handleRequestError(endpoint, error);
  }
};

const executeRequest = async (endpoint, params, caseWorkflowContext) => {
  const { url: baseUrl, headers: configHeaders } = resolveEndpoint(
    endpoint,
    caseWorkflowContext,
  );

  const pathParams = params.PATH || {};
  const requestData = params.REQUEST || {};
  const fullUrl = buildUrl(baseUrl, endpoint.path, pathParams);
  const options = buildRequestOptions(
    endpoint.method,
    configHeaders,
    requestData,
  );

  logRequestStart(endpoint, fullUrl, options.headers);

  const response = await Wreck.request(endpoint.method, fullUrl, options);
  const payload = await Wreck.read(response, { json: true });

  return { response, payload };
};

const buildRequestOptions = (
  method,
  configHeaders,
  requestData,
  timeout = DEFAULT_TIMEOUT_MS,
) => {
  const options = {
    headers: {
      "Content-Type": "application/json",
      ...configHeaders,
    },
    json: true,
    timeout,
  };

  if (shouldIncludePayload(method, requestData)) {
    options.payload = requestData;
  }

  return options;
};

const shouldIncludePayload = (method, requestData) => {
  return (
    method !== "GET" &&
    method !== "HEAD" &&
    requestData &&
    Object.keys(requestData).length > 0
  );
};

const logRequestStart = (endpoint, url, headers) => {
  logger.info(
    {
      endpoint: endpoint.code,
      method: endpoint.method,
      url,
      headers,
    },
    `Calling external endpoint: ${endpoint.code}`,
  );
};

const handleResponse = (endpoint, response, payload) => {
  if (isSuccessStatus(response.statusCode)) {
    logSuccess(endpoint, response.statusCode);
    return payload;
  }

  logNonSuccessStatus(endpoint, response.statusCode, payload);
  return null;
};

const isSuccessStatus = (statusCode) => {
  return statusCode >= HTTP_SUCCESS_MIN && statusCode < HTTP_SUCCESS_MAX;
};

const logSuccess = (endpoint, statusCode) => {
  logger.info(
    {
      endpoint: endpoint.code,
      statusCode,
    },
    `External endpoint call successful: ${endpoint.code}`,
  );
};

const logNonSuccessStatus = (endpoint, statusCode, responseBody) => {
  logger.warn(
    {
      endpoint: endpoint.code,
      statusCode,
      responseBody,
    },
    `External endpoint returned non-success status: ${statusCode}`,
  );
};

const handleRequestError = (endpoint, error) => {
  logger.error(
    {
      error,
      endpoint: endpoint.code,
      message: error.message,
    },
    `Failed to call external endpoint: ${endpoint.code}`,
  );
  return null;
};

/**
 * Builds the full URL by replacing path parameters in the template.
 * Example: '/api/{id}' with {id: 123} => 'http://base.url/api/123'
 */
export const buildUrl = (baseUrl, pathTemplate, pathParams) => {
  const path = replacePathParameters(pathTemplate, pathParams);
  const cleanBaseUrl = removeTrailingSlash(baseUrl);
  const cleanPath = ensureLeadingSlash(path);
  return `${cleanBaseUrl}${cleanPath}`;
};

const replacePathParameters = (pathTemplate, pathParams) => {
  let path = pathTemplate;

  for (const [key, value] of Object.entries(pathParams)) {
    validatePathParameter(key, value, pathTemplate, pathParams);
    const placeholder = `{${key}}`;
    path = path.replace(placeholder, encodeURIComponent(String(value)));
  }

  return path;
};

const validatePathParameter = (key, value, pathTemplate, allParams) => {
  if (isInvalidValue(value)) {
    logInvalidParameter(key, value, pathTemplate, allParams);
    throw new Error(buildErrorMessage(key, value));
  }
};

const isInvalidValue = (value) => {
  return value === undefined || value === null || value === "";
};

const logInvalidParameter = (key, value, pathTemplate, allParams) => {
  logger.error(
    {
      parameter: key,
      value,
      pathTemplate,
      allParams,
    },
    `Missing or invalid path parameter: ${key}`,
  );
};

const buildErrorMessage = (key, value) => {
  const valueDescription = getValueDescription(value);
  return `Path parameter '${key}' is required but was ${valueDescription}`;
};

const getValueDescription = (value) => {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  return "empty";
};

const removeTrailingSlash = (url) => {
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

const ensureLeadingSlash = (path) => {
  return path.startsWith("/") ? path : `/${path}`;
};
