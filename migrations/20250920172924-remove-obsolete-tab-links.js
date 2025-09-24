export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $unset: {
        "pages.cases.details.tabs.case-details.link": "",
        "pages.cases.details.tabs.agreements.link": "",
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.link": {
          id: "case-details",
          href: {
            urlTemplate: "/cases/{caseId}/case-details",
            params: { caseId: "$._id" },
          },
          text: "Case Details",
          index: 1,
        },
        "pages.cases.details.tabs.agreements.link": {
          id: "agreements",
          href: {
            urlTemplate: "/cases/{caseId}/agreements",
            params: { caseId: "$._id" },
          },
          text: "Agreements",
        },
      },
    },
  );
};
