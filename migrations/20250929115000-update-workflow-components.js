export const up = async (db) => {
  // Update PMF workflow - fix component types from "list" to "summary-list"
  const pmfResult = await db.collection("workflows").updateOne(
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

  // Update FRPS workflow - fix component type from "list" to "summary-list"
  const frpsResult = await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content.2.component":
          "summary-list",
      },
    },
  );

  console.log(`✅ Updated component types to "summary-list":`);
  console.log(
    `  - PMF workflow: ${pmfResult.modifiedCount} document(s) modified`,
  );
  console.log(
    `  - FRPS workflow: ${frpsResult.modifiedCount} document(s) modified`,
  );
};

export const down = async (db) => {
  // Rollback PMF workflow
  const pmfResult = await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.sections.0.component": "list",
        "pages.cases.details.tabs.case-details.sections.1.component": "list",
      },
    },
  );

  // Rollback FRPS workflow
  const frpsResult = await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content.2.component": "list",
      },
    },
  );

  console.log(`⏪ Rolled back component types to "list":`);
  console.log(
    `  - PMF workflow: ${pmfResult.modifiedCount} document(s) modified`,
  );
  console.log(
    `  - FRPS workflow: ${frpsResult.modifiedCount} document(s) modified`,
  );
};
