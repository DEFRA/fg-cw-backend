export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps" },
    {
      $set: {
        "phases.1.stages.0.beforeContent": [
          {
            renderIf: "jsonata:$.position.statusCode = 'AGREEMENT_ACCEPTED'",
            content: [
              {
                component: "paragraph",
                text: "Agreement is live. However, you need to check the land parcel calculations have not changed.",
              },
            ],
          },
        ],
        "phases.1.stages.0.taskGroups": [
          {
            code: "PAYMENT_CONTROL_CHECK",
            name: "Payment control tasks (6 months)",
            description: "Payment control check tasks",
            tasks: [
              {
                code: "PAYMENT_CONTROL_CHECK",
                name: "Payment control tasks 6-month check",
                mandatory: true,
                description: [
                  {
                    component: "heading",
                    text: "Payment control tasks 6-month check",
                    level: 2,
                    classes: "govuk-!-margin-bottom-3",
                  },
                  {
                    component: "paragraph",
                    text: "The agreement is now due a sixth month check to confirm the land parcel calculations have not changed.",
                  },
                  {
                    component: "ordered-list",
                    classes:
                      "govuk-list govuk-list--number govuk-list--spaced govuk-!-margin-bottom-6",
                    items: [
                      {
                        component: "container",
                        items: [
                          {
                            component: "text",
                            text: "Run available area calculations again (found in the banner).",
                            classes: "govuk-!-font-weight-bold",
                          },
                          {
                            component: "paragraph",
                            text: "This will identify any failures against the current rules and the reason for the failure.",
                          },
                        ],
                      },
                      {
                        component: "container",
                        items: [
                          {
                            component: "text",
                            text: "Review available area calculation results for failures.",
                            classes: "govuk-!-font-weight-bold",
                          },
                          {
                            component: "paragraph",
                            text: "Try to resolve by requesting information from the customer, running the calculations again or updating the systems.",
                          },
                        ],
                      },
                      {
                        component: "container",
                        items: [
                          {
                            component: "text",
                            text: "Management control check",
                            classes: "govuk-!-font-weight-bold",
                          },
                          {
                            component: "paragraph",
                            text: "Check that the Business Owner still has management control for the SBI. Check Land Management System (LMS) for management control issues, for example, live overlapping agreements or overlapping previous agreement dates.",
                          },
                        ],
                      },
                      {
                        component: "container",
                        items: [
                          {
                            component: "text",
                            text: "Check if land parcel is in Siti Tenure.",
                            classes: "govuk-!-font-weight-bold",
                          },
                          {
                            component: "paragraph",
                            text: "Confirm the land parcels within the agreement are still linked to the agreement holder and the land parcels in this agreement are linked to the customer's single business identifier (SBI) and are within the agreement start and end dates.",
                          },
                        ],
                      },
                      {
                        component: "container",
                        items: [
                          {
                            component: "text",
                            text: "Confirm if land parcel ID is in LPIS.",
                            classes: "govuk-!-font-weight-bold",
                          },
                          {
                            component: "paragraph",
                            text: "Check for mapping changes. Try to resolve by investigating the cause of mapping error for merges, splits or transfers. Decide if parcel can remain in agreement or make any permitted amendments. Update notes on system.",
                          },
                        ],
                      },
                    ],
                  },
                ],
                statusOptions: [
                  {
                    code: "NO_ACTION",
                    name: "No action needed",
                    theme: "SUCCESS",
                    altName: "No action needed",
                    completes: true,
                  },
                  {
                    code: "ESCALATE",
                    name: "Escalated",
                    theme: "WARN",
                    altName: "Escalate",
                    completes: false,
                  },
                  {
                    code: "RFI",
                    name: "Information requested",
                    theme: "INFO",
                    altName: "Request information from customer",
                    completes: false,
                  },
                  {
                    code: "CANNOT_ACCEPT",
                    name: "Cannot accept",
                    theme: "ERROR",
                    altName: "Cannot accept",
                    completes: false,
                  },
                ],
              },
            ],
          },
        ],
        "phases.1.stages.0.afterContent": [
          {
            renderIf: "jsonata:$.position.statusCode = 'AGREEMENT_ACCEPTED'",
            content: [
              {
                component: "heading",
                text: "Terminating this agreement",
                level: 2,
                classes: "govuk-heading-s",
              },
              {
                component: "paragraph",
                text: "You may want to terminate this agreement if:",
              },
              {
                component: "unordered-list",
                classes: "govuk-list govuk-list--bullet",
                items: [
                  {
                    component: "text",
                    text: "the agreement holder has informed us in writing to terminate their agreement",
                  },
                  {
                    component: "text",
                    text: "the agreement holder is in breach of the agreement",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  );
};
