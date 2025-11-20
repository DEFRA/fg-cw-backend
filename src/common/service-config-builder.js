import { config } from "./config.js";

/**
 * Converts SCREAMING_SNAKE_CASE to camelCase
 * Example: RULES_ENGINE -> rulesEngine
 */
const toCamelCase = (str) => {
  return str
    .toLowerCase()
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

const createServiceConfig = (service) => {
  const configKey = toCamelCase(service);
  return {
    url: config.get(`externalServices.${configKey}.url`),
    headers: config.get(`externalServices.${configKey}.headers`),
  };
};

const uniqueServices = (endpoints = []) => {
  return [...new Set(endpoints.map(({ service }) => service).filter(Boolean))];
};

/**
 * Dynamically builds service configuration mapping from workflow definitions
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
