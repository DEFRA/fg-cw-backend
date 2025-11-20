import { buildServiceConfigMap } from "./service-config-builder.js";

/**
 * Resolves environment variable references in a string.
 * Replaces ${VAR_NAME} with the actual environment variable value.
 */
export const resolveEnvVarReferences = (value) => {
  if (!value || typeof value !== "string") {
    return value;
  }

  return value.replace(/\$\{([^}]+)\}/g, (match, envVarName) => {
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
 */
export const parseHeaders = (headersString) => {
  if (!headersString) {
    return {};
  }

  const headers = {};
  const headerPairs = headersString.split(",");

  for (const pair of headerPairs) {
    const colonIndex = pair.indexOf(":");
    if (colonIndex === -1) {
      throw new Error("Invalid header format");
    }

    const name = pair.substring(0, colonIndex).trim();
    const value = pair.substring(colonIndex + 1).trim();

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
