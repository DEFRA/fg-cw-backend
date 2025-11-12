export const up = async (db) => {
  // Remove the "Confirm eligibility" and "Land Details" sections
  // from the FRPS workflow case details tab

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

  // Find the accordion component
  const accordion = updatedContent.find(
    (item) => item.component === "accordion",
  );

  if (accordion && accordion.items) {
    // Filter out the "Confirm eligibility" and "Land Details" sections
    accordion.items = accordion.items.filter((item) => {
      const headingText = item.heading?.[0]?.text;
      return (
        headingText !== "Confirm eligibility" && headingText !== "Land Details"
      );
    });
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
  // Restore the "Confirm eligibility" and "Land Details" sections
  // to the FRPS workflow case details tab

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

  // Find the accordion component
  const accordion = updatedContent.find(
    (item) => item.component === "accordion",
  );

  if (accordion && accordion.items) {
    // Find the position to insert the sections (after "Customer details")
    const customerDetailsIndex = accordion.items.findIndex(
      (item) => item.heading?.[0]?.text === "Customer details",
    );

    if (customerDetailsIndex !== -1) {
      // Define the sections to restore
      const confirmEligibilitySection = {
        heading: [
          {
            text: "Confirm eligibility",
          },
        ],
        content: [
          {
            component: "summary-list",
            rows: [
              {
                label: "Confirm you will be eligible",
                text: "$.payload.answers.confirmEligible",
                type: "boolean",
                format: "yesNo",
              },
            ],
          },
        ],
      };

      const landDetailsSection = {
        heading: [
          {
            text: "Land Details",
          },
        ],
        content: [
          {
            component: "summary-list",
            rows: [
              {
                label: "Digital maps show correct land details",
                text: "$.payload.answers.digitalMapsCorrectDetails",
                type: "boolean",
                format: "yesNo",
              },
            ],
          },
        ],
      };

      // Insert the sections after "Customer details"
      accordion.items.splice(
        customerDetailsIndex + 1,
        0,
        confirmEligibilitySection,
        landDetailsSection,
      );
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
