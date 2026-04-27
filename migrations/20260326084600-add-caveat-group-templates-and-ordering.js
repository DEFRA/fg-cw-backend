const workflowQuery = { code: "frps-private-beta" };

const statutoryConsentRequirementsAccordionItem = {
  component: "conditional",
  id: "statutory-consent-requirements",
  condition: "$.payload.answers.rulesCalculations.caveats[0]",
  whenTrue: {
    heading: [{ text: "Statutory Consent Requirements" }],
    content: [
      {
        component: "repeat",
        id: "caveat-groups",
        itemsRef:
          'jsonata:($caveats := $.payload.answers.rulesCalculations.caveats; $defs := $.templates.caveatGroups; $groups := $distinct($caveats.source).($source := $; {"source": $source, "order": $lookup($defs, $source).order ? $lookup($defs, $source).order : 9999, "caveats": [$caveats[source = $source]]}); $sort($groups, function($l, $r) { $l.order > $r.order }))',
        items: [
          {
            component: "template",
            templateRef: "$.templates.caveatGroups",
            templateKey: "@.source",
          },
          {
            component: "repeat",
            id: "caveats-inner",
            itemsRef: "@.caveats[*]",
            items: [
              {
                component: "template",
                templateRef: "$.templates.caveats",
                templateKey: "@.source",
              },
            ],
          },
        ],
      },
    ],
  },
};

const caveatGroupTemplates = {
  "natural-england": {
    order: 1,
    content: [
      {
        component: "heading",
        text: "SSSI consent",
        level: 2,
        classes: "govuk-heading-m",
      },
      {
        component: "paragraph",
        text: "jsonata:@.caveats[0].description",
      },
    ],
  },
  "historic-england": {
    order: 2,
    content: [
      {
        component: "heading",
        text: "Historic England consent",
        level: 2,
        classes: "govuk-heading-m",
      },
      {
        component: "paragraph",
        text: "jsonata:@.caveats[0].description",
      },
    ],
  },
};

const caveatTemplates = {
  "natural-england": {
    content: [
      {
        component: "heading",
        text: "Land parcel: @.metadata.sheetId @.metadata.parcelId",
        level: 3,
        classes: "govuk-heading-s govuk-!-margin-top-4 govuk-!-margin-bottom-1",
      },
      {
        component: "summary-list",
        rows: [
          {
            label: "Action code",
            text: "@.metadata.actionCode",
          },
          {
            label: "Overlap area",
            text: "@.metadata.overlapAreaHectares Ha",
          },
          {
            label: "Overlap",
            text: "@.metadata.percentageOverlap %",
          },
        ],
      },
    ],
  },
  "historic-england": {
    content: [
      {
        component: "heading",
        text: "Land parcel: @.metadata.sheetId @.metadata.parcelId",
        level: 3,
        classes: "govuk-heading-s govuk-!-margin-top-4 govuk-!-margin-bottom-1",
      },
      {
        component: "summary-list",
        rows: [
          {
            label: "Action code",
            text: "@.metadata.actionCode",
          },
          {
            label: "Overlap area",
            text: "@.metadata.overlapAreaHectares Ha",
          },
          {
            label: "Overlap",
            text: "@.metadata.percentageOverlap %",
          },
        ],
      },
    ],
  },
};

export const up = async (db) => {
  await db.collection("workflows").updateOne(
    workflowQuery,
    {
      $set: {
        "templates.caveatGroups": caveatGroupTemplates,
        "templates.caveats": caveatTemplates,
        "pages.cases.details.tabs.case-details.content.2.items.$[item]":
          statutoryConsentRequirementsAccordionItem,
      },
    },
    {
      arrayFilters: [{ "item.id": "statutory-consent-requirements" }],
    },
  );
};
