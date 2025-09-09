export const up = async (db, _client, context) => {
  const environment = context?.environment || "local";

  const definitions = definitionsLookup[environment] || {};

  await db.collection("workflows").updateMany(
    { code: "pigs-might-fly" },
    {
      $set: {
        definitions,
      },
    },
  );

  console.log(
    `Added definitions for environment "${environment}" ${JSON.stringify(definitions, null, 2)}`,
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateMany(
    { code: "pigs-might-fly" },
    {
      $unset: {
        definitions: "",
      },
    },
  );
};

const definitionsLookup = {
  local: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.dev.cdp-int.defra.cloud/agreement/review-offer",
      externalUrl:
        "https://grants-ui.dev.cdp-int.defra.cloud/agreement/review-offer",
    },
  },
  dev: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.dev.cdp-int.defra.cloud/agreement/review-offer",
      externalUrl:
        "https://grants-ui.dev.cdp-int.defra.cloud/agreement/review-offer",
    },
  },
  test: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.test.cdp-int.defra.cloud/agreement/review-offer",
      externalUrl:
        "https://grants-ui.test.cdp-int.defra.cloud/agreement/review-offer",
    },
  },
  "perf-test": {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.perf-test.cdp-int.defra.cloud/agreement/review-offer",
      externalUrl:
        "https://grants-ui.perf-test.cdp-int.defra.cloud/agreement/review-offer",
    },
  },
  prod: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.prod.cdp-int.defra.cloud/agreement/review-offer",
      externalUrl:
        "https://grants-ui.prod.cdp-int.defra.cloud/agreement/review-offer",
    },
  },
};
