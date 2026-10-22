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

const withoutTrailingSlash = (path) =>
  path.endsWith("/") ? path.slice(0, -1) : path;

const withLeadingSlash = (path) => (path.startsWith("/") ? path : `/${path}`);

/**
 * Where an endpoint resolves to in this environment, for display: the scheme,
 * host and path of {SERVICE}_URL joined to the endpoint's path. User info,
 * query and fragment are dropped, and {SERVICE}_HEADERS is never read.
 */
export const toServiceAddress = ({ service, path }) => {
  const url = URL.parse(process.env[`${service}_URL`] ?? "");

  if (!url) {
    return null;
  }

  return `${url.protocol}//${url.host}${withoutTrailingSlash(url.pathname)}${withLeadingSlash(path)}`;
};
