const statutoryConsentRequirementsAccordionItem = {
  component: "conditional",
  id: "statutory-consent-requirements",
  condition: "$.payload.answers.rulesCalculations.caveats[0]",
  whenTrue: {
    heading: [{ text: "Statutory Consent Requirements" }],
    content: [
      {
        component: "repeat",
        id: "caveats-inner",
        itemsRef: "$.payload.answers.rulesCalculations.caveats[*]",
        items: [
          {
            component: "template",
            templateRef: "$.templates.caveats",
            templateKey: "@.code",
          },
        ],
      },
    ],
  },
};

const caveatsTemplates = {
  caveats: {
    "ne-consent-required": {
      content: [
        {
          id: "title",
          component: "heading",
          text: "Land parcel: @.metadata.sheetId @.metadata.parcelId",
          level: 2,
          classes:
            "govuk-heading-m govuk-!-margin-top-6 govuk-!-margin-bottom-1",
        },
        {
          id: "landParcel",
          component: "summary-list",
          rows: [
            {
              label: "Description",
              text: "@.description",
            },
            {
              label: "Action code",
              text: "@.metadata.actionCode",
            },
            {
              label: "Land parcel",
              text: "@.metadata.sheetId @.metadata.parcelId",
            },
            {
              label: "Overlap %",
              text: "@.metadata.percentageOverlap",
            },
            {
              label: "Overlap area",
              text: "@.metadata.overlapAreaHectares Ha",
            },
          ],
        },
      ],
    },
  },
};

export const up = async (db) => {
  const workflowQuery = { code: "frps-private-beta" };

  await db.collection("workflows").updateOne(workflowQuery, {
    $set: {
      templates: caveatsTemplates,
    },
  });

  await db.collection("workflows").updateOne(workflowQuery, {
    $push: {
      "pages.cases.details.tabs.case-details.content.2.items": {
        $each: [statutoryConsentRequirementsAccordionItem],
        $position: 0,
      },
    },
  });
};
