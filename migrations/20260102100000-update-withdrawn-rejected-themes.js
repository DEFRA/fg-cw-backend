export const up = async (db) => {
  const query = { code: "frps-private-beta" };

  await db.collection("workflows").updateOne(
    query,
    {
      $set: {
        // Update theme for APPLICATION_WITHDRAWN status in all stages/phases
        "phases.$[].stages.$[].statuses.$[status].theme": "WARN",

        // Update themeMap in Agreements tab - summary list
        "pages.cases.details.tabs.agreements.content.1.rows.0.text.0.themeMap.WITHDRAWN":
          "WARN",
        "pages.cases.details.tabs.agreements.content.1.rows.0.text.0.themeMap.REJECTED":
          "ERROR",

        // Update themeMap in Agreements tab - version history table
        "pages.cases.details.tabs.agreements.content.2.whenTrue.items.1.rows.2.themeMap.WITHDRAWN":
          "WARN",
        "pages.cases.details.tabs.agreements.content.2.whenTrue.items.1.rows.2.themeMap.REJECTED":
          "ERROR",
      },
    },
    {
      arrayFilters: [{ "status.code": "APPLICATION_WITHDRAWN" }],
    },
  );
};
