export const up = async (db) => {
  // Update the field reference from hasCheckedLandIsUpToDate to digitalMapsCorrectDetails
  // in the FRPS workflow case details tab

  const workflow = await db
    .collection("workflows")
    .findOne({ code: "frps-private-beta" });

  if (!workflow) {
    throw new Error("FRPS workflow not found");
  }

  const caseDetailsContent =
    workflow.pages?.cases?.details?.tabs?.["case-details"]?.content;

  if (!caseDetailsContent) {
    throw new Error("Case details content not found in FRPS workflow");
  }

  // Deep clone the content to modify it
  const updatedContent = JSON.parse(JSON.stringify(caseDetailsContent));

  // Find and update the Land Details accordion section
  const accordion = updatedContent.find(
    (item) => item.component === "accordion",
  );
  if (accordion && accordion.items) {
    const landDetailsSection = accordion.items.find(
      (item) => item.heading?.[0]?.text === "Land Details",
    );

    if (landDetailsSection && landDetailsSection.content) {
      const summaryList = landDetailsSection.content.find(
        (item) => item.component === "summary-list",
      );

      if (summaryList && summaryList.rows) {
        const landDetailsRow = summaryList.rows.find(
          (row) => row.text === "$.payload.answers.hasCheckedLandIsUpToDate",
        );

        if (landDetailsRow) {
          landDetailsRow.text = "$.payload.answers.digitalMapsCorrectDetails";
        }
      }
    }
  }

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content": updatedContent,
      },
    },
  );
};

export const down = async (db) => {
  // Revert the field reference from digitalMapsCorrectDetails back to hasCheckedLandIsUpToDate

  const workflow = await db
    .collection("workflows")
    .findOne({ code: "frps-private-beta" });

  if (!workflow) {
    throw new Error("FRPS workflow not found");
  }

  const caseDetailsContent =
    workflow.pages?.cases?.details?.tabs?.["case-details"]?.content;

  if (!caseDetailsContent) {
    throw new Error("Case details content not found in FRPS workflow");
  }

  // Deep clone the content to modify it
  const updatedContent = JSON.parse(JSON.stringify(caseDetailsContent));

  // Find and update the Land Details accordion section
  const accordion = updatedContent.find(
    (item) => item.component === "accordion",
  );
  if (accordion && accordion.items) {
    const landDetailsSection = accordion.items.find(
      (item) => item.heading?.[0]?.text === "Land Details",
    );

    if (landDetailsSection && landDetailsSection.content) {
      const summaryList = landDetailsSection.content.find(
        (item) => item.component === "summary-list",
      );

      if (summaryList && summaryList.rows) {
        const landDetailsRow = summaryList.rows.find(
          (row) => row.text === "$.payload.answers.digitalMapsCorrectDetails",
        );

        if (landDetailsRow) {
          landDetailsRow.text = "$.payload.answers.hasCheckedLandIsUpToDate";
        }
      }
    }
  }

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content": updatedContent,
      },
    },
  );
};
