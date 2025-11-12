export const up = async (db, _client, context) => {
  const environment = context?.environment || "local";
  const definitions = definitionsLookup[environment] || {};

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        definitions,
      },
    },
  );
};

const definitionsLookup = {
  local: {
    agreementsService: {
      internalUrl:
        "https://fg-cw-frontend.dev.cdp-int.defra.cloud/agreement/{agreementRef}",
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
  prod: {
    agreementsService: {
      internalUrl:
        "https://fg-cw-frontend.prod.cdp-int.defra.cloud/agreement/{agreementRef}",
    },
  },
};
