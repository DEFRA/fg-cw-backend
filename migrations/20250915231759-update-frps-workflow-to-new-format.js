export const up = async (db, _client, context) => {
  const environment = context?.environment || "local";

  const definitions = definitionsLookup[environment] || {};

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        // Replace the entire pages object with the new definition
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  text: "$.payload.businessName",
                  type: "string",
                },
                summary: {
                  sbi: {
                    label: "SBI",
                    text: "$.payload.identifiers.sbi",
                    type: "string",
                  },
                  reference: {
                    label: "Reference",
                    text: "$.payload.clientRef",
                    type: "string",
                  },
                  scheme: {
                    label: "Scheme",
                    text: "$.payload.answers.scheme",
                    type: "string",
                  },
                  createdAt: {
                    label: "Created At",
                    text: "$.payload.createdAt",
                    type: "date",
                    format: "formatDate",
                  },
                },
              },
              tabs: {
                "case-details": {
                  link: {
                    id: "case-details",
                    href: {
                      urlTemplate: "/cases/{caseId}/case-details",
                      params: {
                        caseId: "$._id",
                      },
                    },
                    text: "Case Details",
                    index: 1,
                  },
                  content: [
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
                      component: "list",
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
                        {
                          text: "$.payload.answers.agreementName",
                          type: "string",
                          label: "Agreement Name",
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
                  ],
                },
                agreements: {
                  renderIf: "$.agreements[0]",
                  link: {
                    id: "agreements",
                    href: {
                      urlTemplate: "/cases/{caseId}/agreements",
                      params: {
                        caseId: "$._id",
                      },
                    },
                    text: "Agreements",
                  },
                  content: [
                    {
                      id: "title",
                      component: "heading",
                      text: "Case grant funding agreement",
                      level: 2,
                      classes: "govuk-!-margin-top-6",
                    },
                    {
                      id: "subtitle",
                      component: "heading",
                      text: "Check the grant funding agreement system to see the final terms of the agreement.",
                      level: 3,
                      classes: "govuk-inset-text",
                    },
                    {
                      id: "agreementName",
                      component: "container",
                      classes: "govuk-body",
                      items: [
                        {
                          text: "Agreement name:",
                          classes: "govuk-!-font-weight-bold",
                        },
                        {
                          text: "[agreement name]",
                        },
                      ],
                    },
                    {
                      type: "array",
                      component: "table",
                      rowsRef: "$.agreements[*]",
                      rows: [
                        {
                          label: "Reference",
                          text: "@.agreementRef",
                        },
                        {
                          label: "Date",
                          text: "@.createdAt",
                          type: "date",
                          format: "formatDate",
                        },
                        {
                          id: "internal",
                          component: "container",
                          label: "View",
                          items: [
                            {
                              label: "Internal",
                              component: "url",
                              text: "Internal",
                              href: {
                                urlTemplate:
                                  "$.definitions.agreementsService.internalUrl",
                                params: {
                                  agreementRef: "@.agreementRef",
                                },
                              },
                              target: "_blank",
                              rel: "noopener",
                              classes: "govuk-!-margin-right-6",
                            },
                            {
                              label: "External",
                              component: "copyToClipboard",
                              text: {
                                urlTemplate:
                                  "$.definitions.agreementsService.externalUrl",
                                params: {
                                  agreementRef: "@.agreementRef",
                                },
                              },
                              buttonText: "Copy external",
                              feedbackText: "Copied to clipboard",
                            },
                          ],
                        },
                        {
                          label: "Status",
                          component: "status",
                          text: "@.agreementStatus",
                          classesMap: {
                            OFFERED: "govuk-tag--yellow",
                            ACCEPTED: "govuk-tag--blue",
                            WITHDRAWN: "govuk-tag--grey",
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },

        // Add definitions
        definitions,
      },
    },
  );

  console.log(
    `Added definitions for environment "${environment}" ${JSON.stringify(definitions, null, 2)}`,
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        // Revert to old format
        pages: {
          cases: {
            details: {
              banner: {
                title: { ref: "$.payload.businessName", type: "string" },
                summary: {
                  sbi: {
                    label: "SBI",
                    ref: "$.payload.identifiers.sbi",
                    type: "string",
                  },
                  reference: {
                    label: "Reference",
                    ref: "$.clientRef",
                    type: "string",
                  },
                  scheme: {
                    label: "Scheme",
                    ref: "$.payload.answers.scheme",
                    type: "string",
                  },
                  createdAt: {
                    label: "Created At",
                    ref: "$.payload.createdAt",
                    type: "date",
                  },
                },
              },
              tabs: {
                caseDetails: {
                  sections: [
                    {
                      title: "Answers",
                      type: "object",
                      fields: [
                        {
                          ref: "$.payload.answers.scheme",
                          type: "string",
                          label: "Scheme",
                        },
                        {
                          ref: "$.payload.answers.year",
                          type: "number",
                          label: "Year",
                        },
                        {
                          ref: "$.payload.answers.hasCheckedLandIsUpToDate",
                          type: "boolean",
                          label: "Has checked land is up to date?",
                        },
                        {
                          ref: "$.payload.answers.agreementName",
                          type: "string",
                          label: "Agreement Name",
                        },
                      ],
                      component: "list",
                    },
                    {
                      title: "Selected actions for land parcels",
                      type: "array",
                      fields: [
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
                      component: "table",
                    },
                  ],
                },
              },
            },
          },
        },
      },
      // Remove definitions
      $unset: {
        definitions: "",
      },
    },
  );
};

const definitionsLookup = {
  local: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.dev.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
      externalUrl:
        "https://grants-ui.dev.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
    },
  },
  dev: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.dev.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
      externalUrl:
        "https://grants-ui.dev.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
    },
  },
  test: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.test.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
      externalUrl:
        "https://grants-ui.test.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
    },
  },
  "perf-test": {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.perf-test.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
      externalUrl:
        "https://grants-ui.perf-test.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
    },
  },
  prod: {
    agreementsService: {
      internalUrl:
        "https://farming-grants-agreements-api.prod.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
      externalUrl:
        "https://grants-ui.prod.cdp-int.defra.cloud/agreement/review-offer/{agreementRef}",
    },
  },
};
