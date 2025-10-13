export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content.0.component":
          "summary-list",
        "pages.cases.details.tabs.case-details.content.1.component":
          "summary-list",
      },
      $unset: {
        "pages.cases.details.tabs.case-details.sections": "",
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content.0.component": "list",
        "pages.cases.details.tabs.case-details.content.1.component": "list",
        "pages.cases.details.tabs.case-details.sections": {
          0: {
            component: "summary-list",
          },
          1: {
            component: "summary-list",
          },
        },
      },
    },
  );
};
