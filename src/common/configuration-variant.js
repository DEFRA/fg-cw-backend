export const VARIANT_PATTERN = /^[a-z0-9-]+$/;

export const variantFileName = (file, variant) =>
  variant ? file.replace(/\.json$/, `.${variant}.json`) : file;

export const getConfigurationVariant = (configInstance) => {
  const cdpEnvironment = configInstance.get("cdpEnvironment");
  const rawVariant = configInstance.get("configBroker.variant");

  if (cdpEnvironment === "prod") {
    return "";
  }

  return rawVariant || "";
};

export const logConfigurationVariant = (configInstance, log) => {
  const cdpEnvironment = configInstance.get("cdpEnvironment");
  const rawVariant = configInstance.get("configBroker.variant");

  if (!rawVariant) {
    return;
  }

  if (cdpEnvironment === "prod") {
    log.warn(
      `CONFIGURATION_VARIANT="${rawVariant}" ignored because ENVIRONMENT is prod — using unsuffixed definition files`,
    );
    return;
  }

  log.info(`Configuration variant "${rawVariant}" active — selecting variant definition files`);
};
