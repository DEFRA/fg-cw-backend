export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        // Update section title
        "pages.cases.details.tabs.caseDetails.sections.1.title":
          "Selected actions for land parcels",

        // Reorder fields - put sheetId first, then parcelId
        "pages.cases.details.tabs.caseDetails.sections.1.fields": [
          {
            ref: "$.payload.answers.actionApplications[*].sheetId",
            type: "string",
            label: "Sheet Id",
          },
          {
            ref: "$.payload.answers.actionApplications[*].parcelId",
            type: "string",
            label: "Parcel Id",
          },
          {
            ref: "$.payload.answers.actionApplications[*].code",
            type: "string",
            label: "Code",
          },
          {
            ref: "$.payload.answers.actionApplications[*].appliedFor",
            type: "string",
            label: "Applied For",
            format: "{{quantity | fixed(4)}} {{unit}}",
          },
        ],
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        // Revert section title
        "pages.cases.details.tabs.caseDetails.sections.1.title":
          "Action cases data",

        // Revert field order - parcelId first, then sheetId (without format)
        "pages.cases.details.tabs.caseDetails.sections.1.fields": [
          {
            ref: "$.payload.answers.actionApplications[*].parcelId",
            type: "string",
            label: "Parcel Id",
          },
          {
            ref: "$.payload.answers.actionApplications[*].sheetId",
            type: "string",
            label: "Sheet Id",
          },
          {
            ref: "$.payload.answers.actionApplications[*].code",
            type: "string",
            label: "Code",
          },
          {
            ref: "$.payload.answers.actionApplications[*].appliedFor",
            type: "string",
            label: "Applied For",
          },
        ],
      },
    },
  );
};
