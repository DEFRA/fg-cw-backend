import { wreck } from "./wreck.js";

export const createWorkflow = async (payload = {}) => {
  const response = await wreck.post("/workflows", {
    payload: {
      code: "frps-private-beta",
      pages: {
        cases: {
          details: {
            banner: {
              title: {
                text: "$.payload.answers.applicant.business.name",
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
                  text: "$.caseRef",
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
                renderIf: "$.supplementaryData.agreements[0]",
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
                    classes: "govuk-!-margin-top-8",
                  },
                  {
                    id: "subtitle",
                    component: "heading",
                    text: "Check the grant funding agreement system to see the final terms of the agreement.",
                    level: 3,
                    classes: "govuk-inset-text",
                  },
                  {
                    type: "array",
                    component: "table",
                    rowsRef: "$.supplementaryData.agreements[*]",
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
                                "$.definitions.agreementsService.internalUrlTemplate",
                              params: {
                                agreementRef: "@.agreementRef",
                              },
                            },
                            target: "_blank",
                            rel: "noopener",
                            classes: "govuk-!-margin-right-6",
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
      phases: [
        {
          code: "DEFAULT",
          name: "Default Phase",
          stages: [
            {
              code: "APPLICATION_RECEIPT",
              name: "Application Receipt",
              description: "Application received",
              statuses: [
                {
                  code: "AWAITING_REVIEW",
                  name: "Awaiting Review",
                  description: null,
                  interactive: true,
                  transitions: [
                    {
                      targetPosition: "DEFAULT:CONTRACT:",
                      action: {
                        code: "APPROVE",
                        name: "Approve",
                        comment: null,
                        checkTasks: true,
                      },
                    },
                  ],
                },
              ],
              taskGroups: [
                {
                  code: "APPLICATION_RECEIPT_TASKS",
                  name: "Application Receipt tasks",
                  description: "Task group description",
                  tasks: [
                    {
                      code: "SIMPLE_REVIEW",
                      name: "Simple Review",
                      description: "Simple review task",
                      mandatory: true,
                      statusOptions: [],
                      requiredRoles: {
                        allOf: ["ROLE_1", "ROLE_2"],
                        anyOf: ["ROLE_3"],
                      },
                    },
                  ],
                },
              ],
            },
            {
              code: "CONTRACT",
              name: "Stage for contract management",
              description: "Awaiting agreement",
              statuses: [
                {
                  code: "AWAITING_AGREEMENT",
                  name: "Awaiting Agreement",
                  description: "Awaiting agreement signature",
                  interactive: true,
                  transitions: [],
                },
              ],
              taskGroups: [],
            },
          ],
        },
      ],
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
      endpoints: [
        {
          code: "TEST_ENDPOINT",
          service: "TEST_SERVICE",
          path: "/test",
          method: "GET",
          request: null,
        },
      ],
      definitions: {
        key1: "test",
      },
      endpoints: [],
      ...payload,
    },
  });

  return response.payload;
};
