// Accordion item index where we want to insert (after land parcels, before Payment)
const ACCORDION_INSERT_INDEX = 2;

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
  // Get the current workflow to access the accordion items array
  const workflow = await db
    .collection("workflows")
    .findOne({ code: "frps-private-beta" });

  if (!workflow) {
    console.log("Workflow frps-private-beta not found, skipping migration");
    return;
  }

  // Get the current accordion items from case-details tab
  const accordionItems =
    workflow.pages?.cases?.details?.tabs?.["case-details"]?.content?.[2]
      ?.items || [];

  // Insert the new accordion item at the specified index (after land parcels, before Payment)
  const updatedItems = [
    ...accordionItems.slice(0, ACCORDION_INSERT_INDEX),
    agreementLevelActionsAccordion,
    ...accordionItems.slice(ACCORDION_INSERT_INDEX),
  ];

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content.2.items": updatedItems,
      },
    },
  );
};
