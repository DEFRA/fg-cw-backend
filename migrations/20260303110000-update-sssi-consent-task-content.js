const sssiConsentRequestedDescription = [
  {
    component: "heading",
    text: "Check notice of planned activity for site of special scientific interest (SSSI) has been requested",
    level: 2,
    classes: "govuk-!-margin-bottom-6",
  },
  {
    component: "container",
    classes: "govuk-!-margin-bottom-6 govuk-body",
    items: [
      {
        component: "text",
        text: "Land parcels within this application intersect with at least one SSSI. You can see which land parcels in the ",
      },
      {
        component: "url",
        text: "application",
        href: {
          urlTemplate: "/cases/{caseId}/case-details",
          params: {
            caseId: "$._id",
          },
        },
        target: "_self",
      },
      {
        component: "text",
        text: ".",
      },
    ],
  },
  {
    component: "paragraph",
    text: "Check if a notice of planned activity has been submitted to Natural England.",
    classes: "govuk-!-margin-bottom-6",
  },
  {
    component: "paragraph",
    text: "Consent does not have to be issued to accept. The notice of planned activity only has to have been received by Natural England.",
    classes: "govuk-!-margin-bottom-6",
  },
  {
    component: "container",
    classes: "govuk-!-margin-bottom-6 govuk-body",
    items: [
      {
        component: "url",
        text: "View SSSI tracker spreadsheet",
        href: "https://defra.sharepoint.com/:x:/r/teams/Team1512/SFI%2024%20expanded%20offer/SSSI/SFI%2024%20Expanded%20offer%20SSSI%20Shared%20Spreadsheet%20V1.xlsm?d=wda46d49f73e44fdb8da1777b927c2b92&csf=1&web=1&e=FtxaTy",
        target: "_blank",
        rel: "noopener",
      },
    ],
  },
];

export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "phases.0.stages.0.taskGroups.0.tasks.2.description":
          sssiConsentRequestedDescription,
      },
    },
  );
};
