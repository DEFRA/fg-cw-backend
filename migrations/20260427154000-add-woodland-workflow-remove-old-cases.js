const workflow = {
  code: "woodland",
  requiredRoles: { allOf: ["ROLE_WMP"], anyOf: [] },
  templates: {},
  definitions: {},
  endpoints: [],
  externalActions: [],
  pages: {
    cases: {
      details: {
        banner: {
          title: {
            text: "$.payload.answers.applicant.business.name",
            type: "string",
          },
          summary: {
            scheme: {
              label: "Scheme",
              text: "Woodland",
              type: "string",
            },
            applicationId: {
              label: "Application ID",
              text: "$.caseRef",
              type: "string",
            },
            sbi: {
              label: "SBI",
              text: "$.payload.identifiers.sbi",
              type: "string",
            },
            status: {
              label: "Status",
              text: "$.currentStatusName",
              type: "string",
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
              text: "Application",
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
                    expanded: true,
                    content: [
                      {
                        component: "summary-list",
                        rows: [
                          {
                            label: "Name",
                            text: "$.payload.answers.applicant.customer.name.title $.payload.answers.applicant.customer.name.first $.payload.answers.applicant.customer.name.middle $.payload.answers.applicant.customer.name.last",
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
                                component: "conditional",
                                condition:
                                  "$.payload.answers.applicant.business.address.line2",
                                whenTrue: {
                                  component: "container",
                                  items: [
                                    {
                                      component: "text",
                                      text: "$.payload.answers.applicant.business.address.line2",
                                    },
                                    {
                                      component: "line-break",
                                    },
                                  ],
                                },
                              },
                              {
                                component: "conditional",
                                condition:
                                  "$.payload.answers.applicant.business.address.line3",
                                whenTrue: {
                                  component: "container",
                                  items: [
                                    {
                                      component: "text",
                                      text: "$.payload.answers.applicant.business.address.line3",
                                    },
                                    {
                                      component: "line-break",
                                    },
                                  ],
                                },
                              },
                              {
                                component: "conditional",
                                condition:
                                  "$.payload.answers.applicant.business.address.line4",
                                whenTrue: {
                                  component: "container",
                                  items: [
                                    {
                                      component: "text",
                                      text: "$.payload.answers.applicant.business.address.line4",
                                    },
                                    {
                                      component: "line-break",
                                    },
                                  ],
                                },
                              },
                              {
                                component: "conditional",
                                condition:
                                  "$.payload.answers.applicant.business.address.line5",
                                whenTrue: {
                                  component: "container",
                                  items: [
                                    {
                                      component: "text",
                                      text: "$.payload.answers.applicant.business.address.line5",
                                    },
                                    {
                                      component: "line-break",
                                    },
                                  ],
                                },
                              },
                              {
                                component: "conditional",
                                condition:
                                  "$.payload.answers.applicant.business.address.city",
                                whenTrue: {
                                  component: "container",
                                  items: [
                                    {
                                      component: "text",
                                      text: "$.payload.answers.applicant.business.address.city",
                                    },
                                    {
                                      component: "line-break",
                                    },
                                  ],
                                },
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
                            component: "conditional",
                            condition:
                              "$.payload.answers.applicant.business.email.address",
                            whenTrue: {
                              label: "Email address",
                              text: "$.payload.answers.applicant.business.email.address",
                            },
                          },
                          {
                            component: "conditional",
                            condition:
                              "$.payload.answers.applicant.business.phone.landline",
                            whenTrue: {
                              label: "Telephone",
                              text: "$.payload.answers.applicant.business.phone.landline",
                            },
                          },
                          {
                            component: "conditional",
                            condition:
                              "$.payload.answers.applicant.business.phone.mobile",
                            whenTrue: {
                              label: "Mobile",
                              text: "$.payload.answers.applicant.business.phone.mobile",
                            },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    heading: [
                      {
                        text: "Eligibility declarations",
                      },
                    ],
                    content: [
                      {
                        component: "summary-list",
                        rows: [
                          {
                            label: "Business details are up to date",
                            text: "$.payload.answers.businessDetailsUpToDate",
                            format: "yesNo",
                          },
                          {
                            label: "Land is registered with RPA",
                            text: "$.payload.answers.landRegisteredWithRpa",
                            format: "yesNo",
                          },
                          {
                            label: "Has management control of the land",
                            text: "$.payload.answers.landManagementControl",
                            format: "yesNo",
                          },
                          {
                            label: "Public body tenant",
                            text: "$.payload.answers.publicBodyTenant",
                            format: "yesNo",
                          },
                          {
                            label: "Land has grazing rights",
                            text: "$.payload.answers.landHasGrazingRights",
                            format: "yesNo",
                          },
                          {
                            label: "Guidance read",
                            text: "$.payload.answers.guidanceRead",
                            format: "yesNo",
                          },
                          {
                            label: "Application declaration confirmed",
                            text: "$.payload.answers.applicationConfirmation",
                            format: "yesNo",
                          },
                          {
                            label: "Existing woodland management plan",
                            text: "$.payload.answers.appLandHasExistingWmp",
                            format: "yesNo",
                          },
                          {
                            component: "conditional",
                            condition:
                              "$.payload.answers.appLandHasExistingWmp",
                            whenTrue: {
                              component: "conditional",
                              condition: "$.payload.answers.existingWmps",
                              whenTrue: {
                                label:
                                  "Existing woodland management plan details",
                                text: "$.payload.answers.existingWmps",
                              },
                            },
                          },
                          {
                            label: "Intends to apply for Higher Tier",
                            text: "$.payload.answers.intendToApplyHigherTier",
                            format: "yesNo",
                          },
                          {
                            component: "conditional",
                            condition: "$.payload.answers.detailsConfirmedAt",
                            whenTrue: {
                              label: "Details confirmed",
                              text: "$.payload.answers.detailsConfirmedAt",
                              format: "formatDateTime",
                            },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    heading: [
                      {
                        text: "Woodland details",
                      },
                    ],
                    content: [
                      {
                        component: "summary-list",
                        rows: [
                          {
                            component: "conditional",
                            condition: "$.payload.answers.woodlandName",
                            whenTrue: {
                              label: "Woodland name",
                              text: "$.payload.answers.woodlandName",
                            },
                          },
                          {
                            label: "Total woodland area applied for",
                            text: "jsonata:($.payload.answers.totalHectaresAppliedFor ? $.payload.answers.totalHectaresAppliedFor : $.payload.answers.totalHectaresForSelectedParcels) & ' ha'",
                          },
                          {
                            label: "Woodland 10 years or older",
                            text: "$.payload.answers.hectaresTenOrOverYearsOld ha",
                          },
                          {
                            label: "Woodland under 10 years old",
                            text: "$.payload.answers.hectaresUnderTenYearsOld ha",
                          },
                          {
                            label: "Centre grid reference",
                            text: "$.payload.answers.centreGridReference",
                          },
                          {
                            label: "Forestry commission team code",
                            text: "$.payload.answers.fcTeamCode",
                          },
                          {
                            label: "Included all eligible woodland",
                            text: "$.payload.answers.includedAllEligibleWoodland",
                            format: "yesNo",
                          },
                        ],
                      },
                    ],
                  },
                  {
                    heading: [
                      {
                        text: "Land parcels",
                      },
                    ],
                    content: [
                      {
                        component: "table",
                        rowsRef: "$.payload.answers.landParcels[*]",
                        head: [
                          {
                            component: "text",
                            text: "Parcel ID",
                          },
                          {
                            component: "text",
                            text: "Area (ha)",
                            format: "numeric",
                          },
                        ],
                        rows: [
                          {
                            text: "@.parcelId",
                          },
                          {
                            text: "@.areaHa",
                            format: "numeric",
                          },
                        ],
                      },
                    ],
                  },
                  {
                    heading: [
                      {
                        text: "Payment details",
                      },
                    ],
                    content: [
                      {
                        component: "conditional",
                        condition: "$.payload.answers.payments.agreement[0]",
                        whenTrue: {
                          component: "container",
                          items: [
                            {
                              component: "repeat",
                              itemsRef:
                                "$.payload.answers.payments.agreement[*]",
                              items: [
                                {
                                  component: "heading",
                                  text: "@.code",
                                  level: 3,
                                  classes:
                                    "govuk-heading-m govuk-!-margin-bottom-1",
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
                                      label: "Active payment tier",
                                      text: "@.activePaymentTier",
                                    },
                                    {
                                      label: "Quantity in active tier",
                                      text: "@.quantityInActiveTier @.unit",
                                    },
                                    {
                                      label: "Active tier rate",
                                      text: [
                                        {
                                          text: "@.activeTierRatePence",
                                          format: "penniesToPounds",
                                        },
                                        {
                                          text: " per ",
                                        },
                                        {
                                          text: "@.unit",
                                        },
                                      ],
                                    },
                                    {
                                      label: "Active tier flat rate",
                                      text: "@.activeTierFlatRatePence",
                                      format: "penniesToPounds",
                                    },
                                    {
                                      label: "Total payment",
                                      text: "@.agreementTotalPence",
                                      format: "penniesToPounds",
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
                  },
                ],
              },
            ],
          },
        },
      },
    },
  },
  phases: [
    {
      code: "PHASE_PRE_AWARD",
      name: "Pre-award",
      stages: [
        {
          code: "STAGE_REVIEWING_APPLICATION",
          name: "Reviewing Application",
          description: "Review the woodland management plan application",
          statuses: [
            {
              code: "STATUS_APPLICATION_RECEIVED",
              name: "Application Received",
              theme: "NEUTRAL",
              description: "Application received and pending review",
              interactive: false,
              transitions: [],
            },
            {
              code: "STATUS_IN_REVIEW",
              name: "In Review",
              theme: "INFO",
              description: "Application is being reviewed",
              interactive: true,
              transitions: [],
            },
          ],
          taskGroups: [],
        },
      ],
    },
  ],
};

export const up = async (db) => {
  await db.collection("cases").deleteMany({ workflowCode: "woodland" });
  await db.collection("workflows").deleteOne({ code: "woodland" });
  await db.collection("workflows").insertOne(workflow);
};
