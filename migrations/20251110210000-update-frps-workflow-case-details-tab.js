export const up = async (db) => {
  const caseDetailsContent = [
    {
      id: "title",
      component: "heading",
      text: "Application",
      level: 2,
      classes: "govuk-!-margin-top-6 govuk-!-margin-bottom-1",
    },
    {
      id: "submittedDate",
      component: "container",
      classes: "govuk-body",
      items: [
        {
          text: "Application submitted:",
          classes: "govuk-!-font-weight-regular",
        },
        {
          text: "$.payload.submittedAt",
          classes: "govuk-!-font-weight-bold",
          format: "formatDate",
        },
      ],
    },
    {
      component: "accordion",
      id: "case-events",
      items: [
        {
          heading: [
            {
              text: "Customer details",
            },
          ],
          content: [
            {
              component: "summary-list",
              rows: [
                {
                  label: "Name",
                  text: "$.payload.answers.applicant.customer.name.title $.payload.answers.applicant.customer.name.first  $.payload.answers.applicant.customer.name.middle $.payload.answers.applicant.customer.name.last",
                },
                {
                  label: "Business name",
                  text: "$.payload.answers.applicant.business.name",
                },
                {
                  label: "Address",
                  text: [
                    {
                      component: "text",
                      text: "$.payload.answers.applicant.business.address.line1",
                    },
                    {
                      component: "line-break",
                    },
                    {
                      component: "text",
                      text: "$.payload.answers.applicant.business.address.line2",
                    },
                    {
                      component: "line-break",
                    },
                    {
                      component: "text",
                      text: "$.payload.answers.applicant.business.address.line3",
                    },
                    {
                      component: "line-break",
                    },
                    {
                      component: "text",
                      text: "$.payload.answers.applicant.business.address.street",
                    },
                    {
                      component: "line-break",
                    },
                    {
                      component: "text",
                      text: "$.payload.answers.applicant.business.address.city",
                    },
                    {
                      component: "text",
                      text: "$.payload.answers.applicant.business.address.postalCode",
                    },
                  ],
                },
                {
                  label: "SBI number",
                  text: "$.payload.identifiers.sbi",
                },
                {
                  label: "Contact details",
                  text: [
                    {
                      component: "text",
                      text: "$.payload.answers.applicant.business.email.address",
                    },
                    {
                      component: "line-break",
                    },
                    {
                      component: "text",
                      text: "$.payload.answers.applicant.business.phone.mobile",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
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
        },
        {
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
                  text: "$.payload.answers.hasCheckedLandIsUpToDate",
                  type: "boolean",
                  format: "yesNo",
                },
              ],
            },
          ],
        },
        {
          component: "repeat",
          id: "land-parcels",
          itemsRef: "$.payload.answers.parcels[*]",
          items: {
            heading: [
              {
                text: "Land parcel selected : @.sheetId @.parcelId",
              },
            ],
            content: [
              {
                component: "summary-list",
                rows: [
                  {
                    label: "Land parcel",
                    text: [
                      {
                        component: "container",
                        items: [
                          {
                            text: "@.sheetId",
                          },
                          {
                            text: "@.parcelId",
                          },
                        ],
                      },
                    ],
                  },
                  {
                    component: "repeat",
                    itemsRef: "@.actions[*]",
                    items: [
                      {
                        label: "Action",
                        text: [
                          {
                            component: "container",
                            items: [
                              {
                                text: "@.description",
                              },
                              {
                                text: "-",
                              },
                              {
                                text: "@.code",
                              },
                            ],
                          },
                        ],
                      },
                      {
                        label: "Quantity (ha)",
                        text: [
                          {
                            component: "container",
                            items: [
                              {
                                text: "@.appliedFor.quantity",
                              },
                              {
                                text: "@.appliedFor.unit",
                              },
                            ],
                          },
                        ],
                      },
                      {
                        label: "Payment rate per year",
                        text: [
                          {
                            component: "container",
                            items: [
                              {
                                text: "@.paymentRates.ratePerUnitPence",
                                format: "penniesToPounds",
                              },
                              {
                                text: "@.appliedFor.unit",
                              },
                            ],
                          },
                        ],
                      },
                      {
                        label: "Yearly payment",
                        text: [
                          {
                            text: "@.annualPaymentPence",
                            format: "penniesToPounds",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        {
          heading: [
            {
              text: "Total yearly payment",
            },
          ],
          content: [
            {
              component: "summary-list",
              rows: [
                {
                  label: "Total yearly payment",
                  text: "$.payload.answers.totalAnnualPaymentPence",
                  format: "penniesToPounds",
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content": caseDetailsContent,
      },
    },
  );
};

export const down = async (db) => {
  const oldCaseDetailsContent = [
    {
      id: "title",
      component: "heading",
      text: "Application",
      level: 2,
      classes: "govuk-!-margin-top-8 govuk-!-margin-bottom-1",
    },
    {
      id: "submittedDate",
      component: "container",
      classes: "govuk-body",
      items: [
        {
          text: "submitted:",
          classes: "govuk-!-font-weight-regular",
        },
        {
          text: "$.payload.submittedAt",
          classes: "govuk-!-font-weight-bold",
          format: "formatDate",
        },
      ],
    },
    {
      id: "answers",
      component: "summary-list",
      title: "Answers",
      type: "object",
      rows: [
        {
          text: "$.payload.answers.scheme",
          type: "string",
          label: "Scheme",
        },
        {
          text: "$.payload.answers.year",
          type: "number",
          label: "Year",
        },
        {
          text: "$.payload.answers.hasCheckedLandIsUpToDate",
          type: "boolean",
          label: "Has checked land is up to date?",
          format: "yesNo",
        },
      ],
    },
    {
      id: "actions",
      component: "table",
      rowsRef: "$.payload.answers.actionApplications[*]",
      title: "Selected actions for land parcels",
      type: "array",
      firstCellIsHeader: true,
      rows: [
        {
          text: "@.sheetId",
          type: "string",
          label: "Sheet Id",
        },
        {
          text: "@.parcelId",
          type: "string",
          label: "Parcel Id",
        },
        {
          text: "@.code",
          type: "string",
          label: "Code",
        },
        {
          id: "appliedFor",
          component: "container",
          label: "Applied For",
          items: [
            {
              text: "@.appliedFor.quantity",
              type: "number",
              format: "fixed(4)",
            },
            {
              text: "@.appliedFor.unit",
              type: "string",
            },
          ],
        },
      ],
    },
  ];

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content": oldCaseDetailsContent,
      },
    },
  );
};
