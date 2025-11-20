import { config } from "../src/common/config.js";

export const up = async (db) => {
  const environment = config.get("cdpEnvironment");

  const definitions = {
    local: {
      agreementsService: {
        internalUrl: "http://localhost:3000/agreement/{agreementRef}",
      },
    },
    dev: {
      agreementsService: {
        internalUrl:
          "https://fg-cw-frontend.dev.cdp-int.defra.cloud/agreement/{agreementRef}",
      },
    },
    test: {
      agreementsService: {
        internalUrl:
          "https://fg-cw-frontend.test.cdp-int.defra.cloud/agreement/{agreementRef}",
      },
    },
    "perf-test": {
      agreementsService: {
        internalUrl:
          "https://fg-cw-frontend.perf-test.cdp-int.defra.cloud/agreement/{agreementRef}",
      },
    },
    prod: {
      agreementsService: {
        internalUrl:
          "https://fg-cw-frontend.prod.cdp-int.defra.cloud/agreement/{agreementRef}",
      },
    },
  }[environment];

  const workflow = {
    code: "frps-private-beta",
    requiredRoles: { allOf: [], anyOf: [] },
    definitions,
    endpoints: [
      {
        code: "FETCH_RULES_ENDPOINT",
        service: "RULES_ENGINE",
        path: "/case-management-adapter/application/validation-run/{runId}",
        method: "GET",
        request: null,
      },
    ],
    externalActions: [
      {
        code: "RERUN_RULES",
        name: "Rerun Rules",
        description: "Rerun the business rules validation",
        endpoint: "landGrantsRulesRerun",
        target: {
          position: "PRE_AWARD:REVIEW_APPLICATION:IN_REVIEW",
          node: "landGrantsRulesRun",
          nodeType: "array",
          place: "append",
        },
      },
      {
        code: "FETCH_RULES",
        name: "Fetch Rules",
        description: "Fetch a specific rules engine run by ID",
        endpoint: {
          code: "FETCH_RULES_ENDPOINT",
          endpointParams: {
            PATH: {
              runId:
                "jsonata:$.request.query.runId ? $.request.query.runId : $sort([$.payload.rulesCalculation] ~> $append($.supplementaryData.rulesCalculations), function($l, $r) { $l.date < $r.date })[0].id",
            },
          },
        },
        target: null,
      },
    ],
    pages: {
      cases: {
        details: {
          banner: {
            title: { text: "$.payload.businessName", type: "string" },
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
                      heading: [{ text: "Customer details" }],
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
                                { component: "line-break" },
                                {
                                  component: "text",
                                  text: "$.payload.answers.applicant.business.address.line2",
                                },
                                { component: "line-break" },
                                {
                                  component: "text",
                                  text: "$.payload.answers.applicant.business.address.line3",
                                },
                                { component: "line-break" },
                                {
                                  component: "text",
                                  text: "$.payload.answers.applicant.business.address.street",
                                },
                                { component: "line-break" },
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
                                { component: "line-break" },
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
                                      { text: "@.sheetId" },
                                      { text: "@.parcelId" },
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
                                          { text: "@.description" },
                                          { text: "-" },
                                          { text: "@.code" },
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
                                          { text: "@.appliedFor.unit" },
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
                                          { text: "@.appliedFor.unit" },
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
                      heading: [{ text: "Total yearly payment" }],
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
              ],
            },
            calculations: {
              action: {
                rulesData: "FETCH_RULES",
              },
              content: [
                {
                  component: "heading",
                  text: "Land parcel calculations",
                  level: 1,
                  classes: "govuk-heading-l govuk-!-margin-bottom-1",
                },
                {
                  component: "container",
                  items: [
                    {
                      text: "Rules check last run: ",
                      classes: "govuk-body",
                    },
                    {
                      text: "jsonata:$sort([$.payload.rulesCalculation] ~> $append($.supplementaryData.rulesCalculations), function($l, $r) { $l.date < $r.date })[0].date",
                      format: "formatDateTime",
                      classes: "govuk-body",
                    },
                  ],
                },
                {
                  component: "details",
                  classes: "govuk-!-margin-top-2",
                  summaryItems: [
                    {
                      text: "Show version history",
                    },
                  ],
                  items: [
                    {
                      component: "table",
                      caption: "Dates and amounts",
                      captionClasses: "govuk-table__caption--m",
                      rowsRef:
                        "jsonata:$sort([$.payload.rulesCalculation] ~> $append($.supplementaryData.rulesCalculations), function($l, $r) { $l.date < $r.date })",
                      head: [
                        {
                          component: "text",
                          text: "Date/time",
                        },
                        {
                          component: "text",
                          text: "Result",
                        },
                        {
                          component: "text",
                          text: "Version",
                          classes: "govuk-visually-hidden",
                        },
                      ],
                      rows: [
                        {
                          text: "@.date",
                          format: "formatDateTime",
                        },
                        {
                          component: "status",
                          text: "@.valid",
                          format: "yesNo",
                          classesMap: {
                            Yes: "govuk-tag--green",
                            No: "govuk-tag--red",
                          },
                          labelsMap: {
                            Yes: "Passed",
                            No: "Failed",
                          },
                        },
                        {
                          component: "conditional",
                          condition:
                            "jsonata:$.request.query.runId ? $number($.request.query.runId) = @.id : $sort([$.payload.rulesCalculation] ~> $append($.supplementaryData.rulesCalculations), function($l, $r) { $l.date < $r.date })[0].id = @.id",
                          whenTrue: {
                            component: "text",
                            text: "Currently showing",
                            classes: "govuk-body",
                          },
                          whenFalse: {
                            component: "url",
                            text: "View this version",
                            href: {
                              urlTemplate:
                                "/cases/{caseId}/calculations?runId={runId}",
                              params: {
                                caseId: "$._id",
                                runId: "@.id",
                              },
                            },
                            target: "_self",
                            classes: "govuk-link",
                          },
                        },
                      ],
                      firstCellIsHeader: true,
                    },
                  ],
                  open: "$.request.query.runId",
                },
                {
                  component: "conditional",
                  condition: "$.actionData.rulesData.response[0]",
                  whenFalse: {
                    component: "warning-text",
                    text: "Failed to fetch land parcel calculations",
                  },
                },
                {
                  component: "component-container",
                  contentRef: "$.actionData.rulesData.response",
                },
              ],
            },
            agreements: {
              renderIf: "$.supplementaryData.agreements[0]",
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
                  type: "array",
                  component: "table",
                  rowsRef: "$.supplementaryData.agreements[*]",
                  rows: [
                    { label: "Reference", text: "@.agreementRef" },
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
                            params: { agreementRef: "@.agreementRef" },
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
        code: "PRE_AWARD",
        name: "Pre-award",
        stages: [
          {
            code: "REVIEW_APPLICATION",
            name: "Review Application",
            description: "Review the application for eligibility",
            statuses: [
              {
                code: "APPLICATION_RECEIVED",
                name: "Application Received",
                description: "Application received and pending review",
                interactive: false,
                transitions: [
                  {
                    targetPosition: "PRE_AWARD:REVIEW_APPLICATION:IN_REVIEW",
                    action: {
                      code: "START_REVIEW",
                      name: "Start Review",
                      checkTasks: false,
                      comment: null,
                    },
                  },
                ],
              },
              {
                code: "IN_REVIEW",
                name: "In Review",
                description: "Application is being reviewed",
                interactive: true,
                transitions: [
                  {
                    targetPosition:
                      "PRE_AWARD:REVIEW_APPLICATION:AGREEMENT_GENERATING",
                    action: {
                      code: "APPROVE_APPLICATION",
                      name: "Approve",
                      checkTasks: true,
                      comment: {
                        label: "Note",
                        helpText:
                          "All notes will be saved for auditing purposes",
                        mandatory: true,
                      },
                    },
                  },
                  {
                    targetPosition:
                      "PRE_AWARD:REVIEW_APPLICATION:APPLICATION_REJECTED",
                    action: {
                      code: "REJECT_APPLICATION",
                      name: "Reject",
                      checkTasks: false,
                      comment: {
                        label: "Reason for rejection",
                        helpText:
                          "All notes will be saved for auditing purposes",
                        mandatory: true,
                      },
                    },
                  },
                  {
                    targetPosition: "PRE_AWARD:REVIEW_APPLICATION:PUT_ON_HOLD",
                    action: {
                      code: "PUT_ON_HOLD",
                      name: "Put on Hold",
                      checkTasks: false,
                      comment: {
                        label: "Details of information required",
                        helpText:
                          "All notes will be saved for auditing purposes",
                        mandatory: true,
                      },
                    },
                  },
                ],
              },
              {
                code: "AGREEMENT_GENERATING",
                name: "Agreement Generating",
                description:
                  "Application has been approved and agreement is being generated",
                interactive: true,
                transitions: [
                  {
                    targetPosition: "PRE_AWARD:REVIEW_OFFER:AGREEMENT_DRAFTED",
                    action: null,
                  },
                ],
              },
              {
                code: "APPLICATION_REJECTED",
                name: "Rejected",
                description: "Application has been rejected",
                interactive: true,
                transitions: [
                  {
                    targetPosition: "PRE_AWARD:REVIEW_APPLICATION:IN_REVIEW",
                    action: {
                      code: "REINSTATE_APPLICATION",
                      name: "Reinstate Application",
                      checkTasks: false,
                      comment: {
                        label: "Note",
                        helpText:
                          "All notes will be saved for auditing purposes",
                        mandatory: true,
                      },
                    },
                  },
                ],
              },
              {
                code: "PUT_ON_HOLD",
                name: "On Hold",
                description: "Application is on hold pending more information",
                interactive: true,
                transitions: [
                  {
                    targetPosition: "PRE_AWARD:REVIEW_APPLICATION:IN_REVIEW",
                    action: {
                      code: "REMOVE_ON_HOLD",
                      name: "Remove On Hold",
                      checkTasks: false,
                      comment: {
                        label: "Note",
                        helpText:
                          "All notes will be saved for auditing purposes",
                        mandatory: true,
                      },
                    },
                  },
                  {
                    targetPosition:
                      "PRE_AWARD:REVIEW_APPLICATION:APPLICATION_REJECTED",
                    action: {
                      code: "REJECT_APPLICATION",
                      name: "Reject",
                      checkTasks: false,
                      comment: null,
                    },
                  },
                ],
              },
            ],
            taskGroups: [
              {
                code: "MANUAL_REVIEW_TASKS",
                name: "Manual Review Tasks",
                description:
                  "Tasks to be completed during the initial review of the application",
                tasks: [
                  {
                    code: "CHECK_CUSTOMER_DETAILS",
                    name: "Check Customer Details",
                    mandatory: true,
                    description: "Verify the customer's details for accuracy",
                    statusOptions: [
                      {
                        code: "ACCEPTED",
                        name: "Accept",
                        completes: true,
                      },
                      {
                        code: "RFI",
                        name: "ReRequest information from customer",
                        completes: false,
                      },
                      {
                        code: "INTERNAL_INVESTIGATION",
                        name: "Pause for internal investigation",
                        completes: false,
                      },
                      {
                        code: "CANNOT_COMPLETE",
                        name: "Cannot complete",
                        completes: false,
                      },
                    ],
                  },
                  {
                    code: "REVIEW_LAND_RULES",
                    name: "Land parcel rules checks",
                    mandatory: true,
                    description: "Review land parcels against scheme rules",
                    statusOptions: [
                      {
                        code: "ACCEPTED",
                        name: "Accept",
                        completes: true,
                      },
                      {
                        code: "RFI",
                        name: "ReRequest information from customer",
                        completes: false,
                      },
                      {
                        code: "INTERNAL_INVESTIGATION",
                        name: "Pause for internal investigation",
                        completes: false,
                      },
                      {
                        code: "CANNOT_COMPLETE",
                        name: "Cannot complete",
                        completes: false,
                      },
                    ],
                  },
                  {
                    code: "SSSI_CONSENT_REQUESTED",
                    name: "Check if SSSI consent has been requested",
                    mandatory: true,
                    description:
                      "Verify if SSSI consent is required and has been requested",
                    statusOptions: [
                      {
                        code: "ACCEPTED",
                        name: "Accept",
                        completes: true,
                      },
                      {
                        code: "RFI",
                        name: "ReRequest information from customer",
                        completes: false,
                      },
                      {
                        code: "NOT_REQUIRED",
                        name: "Not Required",
                        completes: true,
                      },
                      {
                        code: "INTERNAL_INVESTIGATION",
                        name: "Pause for internal investigation",
                        completes: false,
                      },
                      {
                        code: "CANNOT_COMPLETE",
                        name: "Cannot complete",
                        completes: false,
                      },
                    ],
                  },
                  {
                    code: "PAYMENT_AMOUNT_CHECK",
                    name: "Check Payment Amount",
                    mandatory: true,
                    description:
                      "Verify the calculated payment amount against scheme limits",
                    statusOptions: [
                      {
                        code: "ACCEPTED",
                        name: "Accept",
                        completes: true,
                      },
                      {
                        code: "RFI",
                        name: "ReRequest information from customer",
                        completes: false,
                      },
                      {
                        code: "INTERNAL_INVESTIGATION",
                        name: "Pause for internal investigation",
                        completes: false,
                      },
                      {
                        code: "CANNOT_COMPLETE",
                        name: "Cannot complete",
                        completes: false,
                      },
                    ],
                  },
                  {
                    code: "REVIEW_SCHEME_BUDGET",
                    name: "Review Scheme Budget",
                    mandatory: true,
                    description:
                      "Review that the budeget is available for the payment",
                    requiredRoles: {
                      allOf: ["ROLE_SFI_REFORM", "ROLE_RPA_FINANCE"],
                      anyOf: [],
                    },
                    statusOptions: [
                      {
                        code: "ACCEPTED",
                        name: "Accept",
                        completes: true,
                      },
                      {
                        code: "RFI",
                        name: "ReRequest information from customer",
                        completes: false,
                      },
                      {
                        code: "INTERNAL_INVESTIGATION",
                        name: "Pause for internal investigation",
                        completes: false,
                      },
                      {
                        code: "CANNOT_COMPLETE",
                        name: "Cannot complete",
                        completes: false,
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            code: "REVIEW_OFFER",
            name: "Review Offer",
            description:
              "Draft agreement is live and can be accepted by the customer.",
            statuses: [
              {
                code: "AGREEMENT_DRAFTED",
                name: "Review Offer",
                description: "Offer is under review",
                interactive: true,
                transitions: [
                  {
                    targetPosition:
                      "PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW:AGREEMENT_OFFERED",
                    action: {
                      code: "AGREEMENT_SENT",
                      name: "Agreement sent",
                      checkTasks: true,
                      comment: null,
                    },
                  },
                  {
                    targetPosition:
                      "PRE_AWARD:REVIEW_OFFER:APPLICATION_REJECTED",
                    action: {
                      code: "REJECT_APPLICATION",
                      name: "Reject Application",
                      checkTasks: false,
                      comment: null,
                    },
                  },
                ],
              },
              {
                code: "APPLICATION_REJECTED",
                name: "Rejected",
                description: "Application has been rejected",
                interactive: true,
                transitions: [
                  {
                    targetPosition: "PRE_AWARD:REVIEW_OFFER:AGREEMENT_DRAFTED",
                    action: {
                      code: "REINSTATE_APPLICATION",
                      name: "Reinstate Application",
                      checkTasks: false,
                      comment: null,
                    },
                  },
                ],
              },
            ],
            taskGroups: [
              {
                code: "DRAFT_AGREEMENT_REVIEW_TASKS",
                name: "Draft agreement review tasks",
                description:
                  "Tasks to be completed during the review of the agreement offer",
                tasks: [
                  {
                    code: "REVIEW_OFFER_DOCUMENT",
                    name: "Check draft funding agreement",
                    mandatory: true,
                    description:
                      "Ensure the offer document is accurate and complete",
                    statusOptions: [
                      {
                        code: "CONFIRM",
                        name: "Confirm",
                        completes: true,
                      },
                      {
                        code: "PROBLEM_FOUND",
                        name: "There's a problem",
                        completes: false,
                      },
                    ],
                  },
                  {
                    code: "OFFER_AGREEMENT",
                    name: "Notify customer that draft agreement is ready",
                    mandatory: true,
                    description:
                      "Send the offer document to the applicant for review and acceptance",
                    statusOptions: [
                      {
                        code: "CONFIRM",
                        name: "Confirm",
                        completes: true,
                      },
                      {
                        code: "PROBLEM_FOUND",
                        name: "There's a problem",
                        completes: false,
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            code: "CUSTOMER_AGREEMENT_REVIEW",
            name: "Customer Agreement Review",
            description: "Customer reviews the agreement offer",
            statuses: [
              {
                code: "AGREEMENT_OFFERED",
                name: "Agreement Offer Made",
                description: "Offer has been made to the applicant",
                interactive: true,
                transitions: [
                  {
                    targetPosition:
                      "POST_AGREEMENT_MONITORING:MONITORING:AGREEMENT_ACCEPTED",
                    action: null,
                  },
                  {
                    targetPosition:
                      "PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW:APPLICATION_REJECTED",
                    action: {
                      code: "REJECT_APPLICATION",
                      name: "Reject",
                      checkTasks: false,
                      comment: null,
                    },
                  },
                ],
              },
              {
                code: "APPLICATION_REJECTED",
                name: "Rejected",
                description: "Application has been rejected",
                interactive: true,
                transitions: [
                  {
                    targetPosition:
                      "PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW:AGREEMENT_OFFERED",
                    action: {
                      code: "REINSTATE_APPLICATION",
                      name: "Reinstate Application",
                      checkTasks: false,
                      comment: null,
                    },
                  },
                ],
              },
            ],
            taskGroups: [],
          },
        ],
      },
      {
        code: "POST_AGREEMENT_MONITORING",
        name: "Post Agreement Monitoring and Compliance",
        stages: [
          {
            code: "MONITORING",
            name: "Monitoring",
            description: "Monitor the agreement and compliance",
            statuses: [
              {
                code: "AGREEMENT_ACCEPTED",
                name: "Agreement accepted",
                description: "Agreement is active and being monitored",
                interactive: true,
                transitions: [
                  {
                    targetPosition:
                      "POST_AGREEMENT_MONITORING:MONITORING:COMPLETE_AGREEMENT",
                    action: {
                      code: "COMPLETE_AGREEMENT",
                      name: "Complete Agreement",
                      checkTasks: true,
                      comment: null,
                    },
                  },
                ],
              },
              {
                code: "COMPLETE_AGREEMENT",
                name: "Complete Agreement",
                description: "Agreement has been completed",
                interactive: false,
                transitions: [],
              },
            ],
            taskGroups: [],
          },
        ],
      },
    ],
  };

  await db.collection("workflows").insertOne(workflow);
};
