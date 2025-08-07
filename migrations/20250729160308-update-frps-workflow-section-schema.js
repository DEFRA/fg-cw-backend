export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.caseDetails.sections.0.type": "object",
        "pages.cases.details.tabs.caseDetails.sections.0.component": "list",
        "pages.cases.details.tabs.caseDetails.sections.1.type": "array",
        "pages.cases.details.tabs.caseDetails.sections.1.component": "table",
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.caseDetails.sections.0.type": "list",
        "pages.cases.details.tabs.caseDetails.sections.1.type": "table",
      },
      $unset: {
        "pages.cases.details.tabs.caseDetails.sections.0.component": "",
        "pages.cases.details.tabs.caseDetails.sections.1.component": "",
      },
    },
  );
};
