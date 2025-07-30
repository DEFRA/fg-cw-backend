export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "pages.cases.details.tabs.caseDetails.sections.0.type": "object",
        "pages.cases.details.tabs.caseDetails.sections.0.component": "list",
        "pages.cases.details.tabs.caseDetails.sections.1.type": "object",
        "pages.cases.details.tabs.caseDetails.sections.1.component": "list",
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "pages.cases.details.tabs.caseDetails.sections.0.type": "list",
        "pages.cases.details.tabs.caseDetails.sections.1.type": "list",
      },
      $unset: {
        "pages.cases.details.tabs.caseDetails.sections.0.component": "",
        "pages.cases.details.tabs.caseDetails.sections.1.component": "",
      },
    },
  );
};
