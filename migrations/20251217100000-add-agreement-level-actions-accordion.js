const agreementLevelActionsAccordion = {
  heading: [
    {
      text: "Agreement level actions",
    },
  ],
  content: [
    {
      component: "conditional",
      condition: "jsonata:$count($.payload.answers.payments.agreement) > 0",
      whenTrue: {
        component: "container",
        items: [
          {
            component: "repeat",
            itemsRef: "$.payload.answers.payments.agreement[*]",
            items: [
              {
                component: "heading",
                text: "@.code",
                level: 3,
                classes: "govuk-heading-m govuk-!-margin-bottom-1",
              },
              {
                component: "paragraph",
                text: "@.description",
                classes: "govuk-body govuk-!-margin-bottom-4",
              },
              {
                component: "summary-list",
                rows: [
                  {
                    label: "Yearly payment",
                    text: [
                      {
                        text: "@.annualPaymentPence",
                        format: "penniesToPounds",
                      },
                    ],
                  },
                  {
                    label: "Duration",
                    text: "jsonata:$string(@.durationYears) & ' years'",
                  },
                ],
              },
            ],
          },
        ],
      },
      whenFalse: {
        component: "paragraph",
        text: "There are no agreement level actions.",
      },
    },
  ],
};

export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $push: {
        "pages.cases.details.tabs.case-details.content.2.items": {
          $each: [agreementLevelActionsAccordion],
          $position: 2,
        },
      },
    },
  );
};
