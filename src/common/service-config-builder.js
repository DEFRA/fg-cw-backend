/**
 * Creates service configuration by reading environment variables
 * based on naming convention: {SERVICE}_URL and {SERVICE}_HEADERS
 *
 * Example: RULES_ENGINE -> reads RULES_ENGINE_URL and RULES_ENGINE_HEADERS
 */
const createServiceConfig = (service) => {
  const urlKey = `${service}_URL`;
  const headersKey = `${service}_HEADERS`;

  return {
    url: process.env[urlKey] || null,
    headers: process.env[headersKey] || null,
  };
};

const uniqueServices = (endpoints = []) => {
  return [...new Set(endpoints.map(({ service }) => service).filter(Boolean))];
};

/**
 * Dynamically builds service configuration mapping from workflow definitions
 * by reading environment variables using the pattern: {SERVICE}_URL and {SERVICE}_HEADERS
 */
export const buildServiceConfigMap = (workflow = {}) => {
  return uniqueServices(workflow.endpoints || []).reduce(
    (serviceConfigMap, service) => {
      serviceConfigMap[service] = createServiceConfig(service);
      return serviceConfigMap;
    },
    {},
  );
};
