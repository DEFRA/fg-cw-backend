export const up = async (db) => {
  // Rename component types from "list" to "summary-list"
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.sections.0.component":
          "summary-list",
        "pages.cases.details.tabs.case-details.sections.1.component":
          "summary-list",
      },
    },
  );

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content.2.component":
          "summary-list",
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.sections.0.component": "list",
        "pages.cases.details.tabs.case-details.sections.1.component": "list",
      },
    },
  );

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content.2.component": "list",
      },
    },
  );
};
