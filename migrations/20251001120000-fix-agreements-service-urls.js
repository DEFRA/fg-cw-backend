import { config } from "../src/common/config.js";
import { logger } from "../src/common/logger.js";

export const up = async (db) => {
  const environment = config.get("cdpEnvironment");
  const definitions = definitionsLookup[environment] || {};

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        definitions,
      },
    },
  );

  logger.info(
    `Migrated: 20251001120000-fix-agreements-service-urls - Updated agreements service URLs for environment "${environment}" ${JSON.stringify(definitions, null, 2)}`,
  );
};

export const down = async (db) => {
  const environment = config.get("cdpEnvironment");
  const oldDefinitions = oldDefinitionsLookup[environment] || {};

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        definitions: oldDefinitions,
      },
    },
  );
};

const definitionsLookup = {
  local: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.dev.cdp-int.defra.cloud/{agreementRef}",
      externalUrl:
        "https://grants-ui.dev.cdp-int.defra.cloud/agreement/{agreementRef}",
    },
  },
  dev: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.dev.cdp-int.defra.cloud/{agreementRef}",
      externalUrl:
        "https://grants-ui.dev.cdp-int.defra.cloud/agreement/{agreementRef}",
    },
  },
  test: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.test.cdp-int.defra.cloud/{agreementRef}",
      externalUrl:
        "https://grants-ui.test.cdp-int.defra.cloud/agreement/{agreementRef}",
    },
  },
  "perf-test": {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.perf-test.cdp-int.defra.cloud/{agreementRef}",
      externalUrl:
        "https://grants-ui.perf-test.cdp-int.defra.cloud/agreement/{agreementRef}",
    },
  },
  prod: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.prod.cdp-int.defra.cloud/{agreementRef}",
      externalUrl:
        "https://grants-ui.prod.cdp-int.defra.cloud/agreement/{agreementRef}",
    },
  },
};

const oldDefinitionsLookup = {
  local: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.dev.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
      externalUrl:
        "https://grants-ui.dev.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
    },
  },
  dev: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.dev.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
      externalUrl:
        "https://grants-ui.dev.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
    },
  },
  test: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.test.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
      externalUrl:
        "https://grants-ui.test.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
    },
  },
  "perf-test": {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.perf-test.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
      externalUrl:
        "https://grants-ui.perf-test.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
    },
  },
  prod: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.prod.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
      externalUrl:
        "https://grants-ui.prod.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
    },
  },
};
