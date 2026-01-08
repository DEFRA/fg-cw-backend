import { config } from "../src/common/config.js";

const WORKFLOW_CODE = "frps-private-beta";

export const up = async (db) => {
  const environment = config.get("cdpEnvironment");

  const definitionsByEnvironment = {
    local: {
      agreementsService: {
        internalUrl: "http://localhost:3000/agreement/{agreementRef}",
      },
    },
    dev: {
      agreementsService: {
        internalUrl:
          "https://fg-cw-frontend.dev.cdp-int.defra.cloud/agreement/{agreementRef}",
      },
    },
    test: {
      agreementsService: {
        internalUrl:
          "https://fg-cw-frontend.test.cdp-int.defra.cloud/agreement/{agreementRef}",
      },
    },
    "perf-test": {
      agreementsService: {
        internalUrl:
          "https://fg-cw-frontend.perf-test.cdp-int.defra.cloud/agreement/{agreementRef}",
      },
    },
    "ext-test": {
      agreementsService: {
        internalUrl:
          "https://fg-cw-frontend.ext-test.cdp-int.defra.cloud/agreement/{agreementRef}",
      },
    },
    prod: {
      agreementsService: {
        internalUrl:
          "https://fg-cw-frontend.prod.cdp-int.defra.cloud/agreement/{agreementRef}",
      },
    },
  };

  const definitions = definitionsByEnvironment[environment];

  if (!definitions) {
    throw new Error(
      `No workflow definitions configured for environment: ${environment}`,
    );
  }

  const result = await db
    .collection("workflows")
    .updateOne({ code: WORKFLOW_CODE }, { $set: { definitions } });

  if (result.matchedCount === 0) {
    throw new Error(`Workflow not found: ${WORKFLOW_CODE}`);
  }
};
