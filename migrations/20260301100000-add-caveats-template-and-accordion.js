const statutoryConsentRequirementsAccordionItem = {
  component: "repeat",
  id: "statutory-consent-requirements",
  itemsRef:
    'jsonata:$.payload.answers.rulesCalculations.caveats[0] ? [{ "caveats": $.payload.answers.rulesCalculations.caveats }] : []',
  items: {
    heading: [{ text: "Statutory Consent Requirements" }],
    content: [
      {
        component: "repeat",
        id: "caveats-inner",
        itemsRef: "@.caveats[*]",
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
              text: "jsonata:$string(@.metadata.percentageOverlap)",
            },
            {
              label: "Overlap area",
              text: "jsonata:$string(@.metadata.overlapAreaHectares) & ' Ha'",
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
