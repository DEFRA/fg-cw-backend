import { buildServiceConfigMap } from "./service-config-builder.js";

/**
 * Resolves environment variable references in a string.
 * Replaces ${VAR_NAME} with the actual environment variable value.
 */
export const resolveEnvVarReferences = (value) => {
  if (!value || typeof value !== "string") {
    return value;
  }

  return value.replace(/\$\{([^}]+)\}/g, (_match, envVarName) => {
    const envValue = process.env[envVarName];
    if (envValue === undefined) {
      throw new Error(
        `Environment variable ${envVarName} referenced in header but not defined`,
      );
    }
    return envValue;
  });
};

/**
 * Parses a comma-separated headers string into an object.
 * Format: "Header1: value1, Header2: value2"
 * Also handles quoted format from environment variables: "Header1: value1, Header2: value2"
 */
export const parseHeaders = (headersString) => {
  if (!headersString) {
    return {};
  }

  // Strip outer quotes if present (handles CDP environment variable format)
  const unquotedString = stripOuterQuotes(headersString);
  const headers = {};
  const headerPairs = unquotedString.split(",");

  for (const pair of headerPairs) {
    // Strip quotes from individual header pairs as well
    const trimmedPair = stripOuterQuotes(pair.trim());
    const colonIndex = trimmedPair.indexOf(":");
    if (colonIndex === -1) {
      throw new Error("Invalid header format");
    }

    const name = trimmedPair.substring(0, colonIndex).trim();
    const value = trimmedPair.substring(colonIndex + 1).trim();

    // Resolve any environment variable references in the value
    headers[name] = resolveEnvVarReferences(value);
  }

  return headers;
};

/**
 * Resolves external endpoint configuration from environment variables.
 * Parses headers and resolves environment variable references.
 *
 */
export const resolveEndpoint = (endpoint, caseWorkflowContext) => {
  const service = endpoint.service;

  // Build dynamic service configuration mapping from workflow
  const dynamicServiceConfigMap = buildServiceConfigMap(
    caseWorkflowContext.workflow,
  );

  const serviceConfig = dynamicServiceConfigMap[service];
  if (!serviceConfig) {
    throw new Error(`Unknown external service: ${service}`);
  }

  const url = serviceConfig.url;
  if (!url) {
    throw new Error(`No URL configured for service: ${service}`);
  }

  const headersString = serviceConfig.headers;
  const headers = parseHeaders(headersString);

  return {
    url,
    headers,
  };
};

const isQuotedString = (str) => {
  return str.startsWith('"') && str.endsWith('"');
};

const stripOuterQuotes = (str) => {
  if (!str || typeof str !== "string") {
    return str;
  }

  return isQuotedString(str) ? str.slice(1, -1) : str;
};
