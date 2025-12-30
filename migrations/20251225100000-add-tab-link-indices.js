export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.calculations.link": {
          id: "calculations",
          href: {
            urlTemplate: "/cases/{caseId}/calculations",
            params: {
              caseId: "$._id",
            },
          },
          text: "Calculations",
          index: 2,
        },
        "pages.cases.details.tabs.agreements.link": {
          id: "agreements",
          href: {
            urlTemplate: "/cases/{caseId}/agreements",
            params: {
              caseId: "$._id",
            },
          },
          text: "Agreements",
          index: 5,
        },
      },
    },
  );
};
