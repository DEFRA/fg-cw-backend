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
      },
      {
        code: "RECALCULATE_RULES_ENDPOINT",
        service: "RULES_ENGINE",
        path: "/case-management-adapter/application/validation-run/rerun",
        method: "POST",
      },
    ],
    externalActions: [
      {
        code: "RECALCULATE_RULES",
        name: "Run calculations again",
        description: "Rerun the business rules validation",
        endpoint: {
          code: "RECALCULATE_RULES_ENDPOINT",
          endpointParams: {
            BODY: {
              id: "$.payload.answers.rulesCalculations.id",
              requesterUsername: "CASEWORKING_SYSTEM",
            },
          },
        },
        display: true,
        target: {
          position: null,
          targetNode: "rulesCalculations",
          dataType: "ARRAY",
          place: "append",
        },
      },
      {
        code: "FETCH_RULES",
        name: "Fetch Rules",
        description: "Fetch a specific rules engine run by ID",
        display: false,
        endpoint: {
          code: "FETCH_RULES_ENDPOINT",
          endpointParams: {
            PATH: {
              runId:
                "jsonata:$.request.query.runId ? $.request.query.runId : $sort([$.payload.answers.rulesCalculations] ~> $append($.supplementaryData.rulesCalculations), function($l, $r) { $l.date < $r.date })[0].id",
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
            title: {
              text: "$.payload.answers.applicant.business.name",
              type: "string",
            },
            summary: {
              scheme: {
                label: "Scheme",
                text: "$.payload.answers.scheme",
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
                      itemsRef: "$.payload.answers.payments.parcel[*]",
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
                                    label: "Total available area for action",
                                    text: [
                                      {
                                        component: "container",
                                        items: [
                                          {
                                            text: "@.eligible.quantity",
                                          },
                                          { text: "@.eligible.unit" },
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
                                            text: "@.paymentRates",
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
                      heading: [{ text: "Payment" }],
                      content: [
                        {
                          component: "summary-list",
                          rows: [
                            {
                              label: "Agreement total payment",
                              text: [
                                {
                                  component: "container",
                                  items: [
                                    {
                                      text: "jsonata:$.payload.answers.totalAnnualPaymentPence * $.payload.answers.payments.parcel[0].actions[0].durationYears",
                                      format: "penniesToPounds",
                                    },
                                    {
                                      text: "jsonata:' over ' & $string($.payload.answers.payments.parcel[0].actions[0].durationYears) & ' years'",
                                    },
                                  ],
                                },
                              ],
                            },
                            {
                              label: "Total yearly payment",
                              text: "$.payload.answers.totalAnnualPaymentPence",
                              format: "penniesToPounds",
                            },
                          ],
                        },
                        {
                          component: "heading",
                          text: "Funded action payment detail",
                          level: 3,
                          classes:
                            "govuk-heading-m govuk-!-margin-top-6 govuk-!-margin-bottom-3",
                        },
                        {
                          component: "summary-list",
                          rows: [
                            {
                              component: "repeat",
                              itemsRef:
                                'jsonata:( $allActions := $.payload.answers.payments.parcel[*].actions[*]; $validActions := $allActions[$exists(paymentRates) and $exists(appliedFor.quantity)]; $distinct($validActions.code).( $currentCode := $; { "code": $currentCode, "actions": $validActions[code=$currentCode] } ) )',
                              items: [
                                {
                                  label: "@.code annual payment",
                                  text: [
                                    {
                                      text: "jsonata:$floor($sum(@.actions.( appliedFor.quantity * paymentRates )) + ($exists($.payload.answers.payments.agreement[code=@.code]) ? $sum($.payload.answers.payments.agreement[code=@.code].annualPaymentPence) : 0))",
                                      format: "penniesToPounds",
                                      classes: "govuk-!-display-block",
                                    },
                                    {
                                      text: "jsonata:'( ' & $join(@.actions.( $string(appliedFor.quantity) & ' ' & appliedFor.unit & ' x £' & $formatNumber(paymentRates / 100, '#.00') & ' per ' & appliedFor.unit ), ', ') & ($exists($.payload.answers.payments.agreement[code=@.code]) ? ', £' & $formatNumber($.payload.answers.payments.agreement[code=@.code].annualPaymentPence / 100, '#.00') & ' per SFI agreement per year' : '') & ' )'",
                                      classes: "govuk-body-m",
                                    },
                                  ],
                                },
                              ],
                            },
                            {
                              component: "repeat",
                              itemsRef:
                                "jsonata:$.payload.answers.payments.agreement[code $not in $.payload.answers.payments.parcel[*].actions[*].code]",
                              items: [
                                {
                                  label: "@.code annual payment",
                                  text: [
                                    {
                                      text: "@.annualPaymentPence",
                                      format: "penniesToPounds",
                                      classes: "govuk-!-display-block",
                                    },
                                    {
                                      component: "container",
                                      classes: "govuk-body-m",
                                      items: [
                                        { text: "(1 ha x " },
                                        {
                                          text: "@.paymentRates",
                                          format: "penniesToPounds",
                                        },
                                        { text: " per ha, " },
                                        {
                                          text: "@.annualPaymentPence",
                                          format: "penniesToPounds",
                                        },
                                        {
                                          text: " per SFI agreement per year)",
                                        },
                                      ],
                                    },
                                  ],
                                },
                              ],
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
                  component: "conditional",
                  condition:
                    "jsonata:[$.payload.answers.rulesCalculations] ~> $append($.supplementaryData.rulesCalculations)[0]",
                  whenTrue: {
                    component: "container",
                    items: [
                      {
                        text: "Rules check last run: ",
                        classes: "govuk-body",
                      },
                      {
                        text: "jsonata:$sort([$.payload.answers.rulesCalculations] ~> $append($.supplementaryData.rulesCalculations), function($l, $r) { $l.date < $r.date })[0].date",
                        format: "formatDateTime",
                        classes: "govuk-body",
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
                              "jsonata:$sort([$.payload.answers.rulesCalculations] ~> $append($.supplementaryData.rulesCalculations), function($l, $r) { $l.date < $r.date })",
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
                                  "jsonata:$.request.query.runId ? $.request.query.runId = $string(@.id) : $sort([$.payload.answers.rulesCalculations] ~> $append($.supplementaryData.rulesCalculations), function($l, $r) { $l.date < $r.date })[0].id = @.id",
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
                    ],
                  },
                  whenFalse: {
                    component: "warning-text",
                    text: "No rules calculation data found",
                  },
                },
                {
                  component: "conditional",
                  condition: "$.actionData.rulesData.response[0]",
                  whenTrue: {
                    component: "component-container",
                    contentRef: "$.actionData.rulesData.response",
                  },
                  whenFalse: {
                    component: "warning-text",
                    text: "Failed to fetch the current land parcel calculations",
                  },
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
            name: "Tasks",
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
                      name: "Start",
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
                        label: "Explain this decision",
                        helpText:
                          "You must include an explanation for auditing purposes.",
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
                        label: "Explain this decision",
                        helpText:
                          "You must include an explanation for auditing purposes.",
                        mandatory: true,
                      },
                    },
                  },
                  {
                    targetPosition: "PRE_AWARD:REVIEW_APPLICATION:ON_HOLD",
                    action: {
                      code: "PUT_ON_HOLD",
                      name: "Put on Hold",
                      checkTasks: false,
                      comment: {
                        label: "Explain this decision",
                        helpText:
                          "You must include an explanation for auditing purposes.",
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
                        label: "Explain this decision",
                        helpText:
                          "You must include an explanation for auditing purposes.",
                        mandatory: true,
                      },
                    },
                  },
                ],
              },
              {
                code: "ON_HOLD",
                name: "On Hold",
                description: "Application is on hold pending more information",
                interactive: true,
                transitions: [
                  {
                    targetPosition: "PRE_AWARD:REVIEW_APPLICATION:IN_REVIEW",
                    action: {
                      code: "RESUME",
                      name: "Resume",
                      checkTasks: false,
                      comment: {
                        label: "Explain this decision",
                        helpText:
                          "You must include an explanation for auditing purposes.",
                        mandatory: true,
                      },
                    },
                  },
                ],
              },
            ],
            taskGroups: [
              {
                code: "MANUAL_REVIEW_TASKS",
                name: "Application review tasks",
                description:
                  "Tasks to be completed during the initial review of the application",
                tasks: [
                  {
                    code: "CHECK_CUSTOMER_DETAILS",
                    name: "Check customer details",
                    mandatory: true,
                    description: [
                      {
                        component: "heading",
                        text: "Check customer details",
                        level: 2,
                        classes: "govuk-!-margin-bottom-3",
                      },
                      {
                        component: "ordered-list",
                        classes:
                          "govuk-list govuk-list--number govuk-!-margin-bottom-6",
                        items: [
                          {
                            component: "container",
                            items: [
                              {
                                component: "text",
                                text: "Go to ",
                              },
                              {
                                component: "url",
                                text: "Application",
                                href: {
                                  urlTemplate: "/cases/{caseId}/case-details",
                                  params: {
                                    caseId: "$._id",
                                  },
                                },
                                target: "_self",
                              },
                              {
                                component: "text",
                                text: " to view submitted customer details.",
                              },
                            ],
                          },
                          {
                            component: "container",
                            items: [
                              {
                                component: "text",
                                text: "Check the submitted details match the details and permissions on the ",
                              },
                              {
                                component: "url",
                                href: "https://www.ruralpayments.service.gov.uk/login",
                                text: "Rural Payments service (opens in new tab)",
                                target: "_blank",
                                rel: "noopener",
                              },
                              {
                                component: "text",
                                text: ".",
                              },
                            ],
                          },
                          {
                            component: "text",
                            text: "Come back to this page and confirm if the details match.",
                          },
                        ],
                      },
                    ],
                    statusOptions: [
                      {
                        code: "ACCEPTED",
                        name: "Accept",
                        completes: true,
                      },
                      {
                        code: "RFI",
                        name: "Request information from customer",
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
                    name: "Review land parcel rule checks",
                    mandatory: true,
                    description: [
                      {
                        component: "heading",
                        text: "Review land parcel rule checks",
                        level: 2,
                        classes: "govuk-!-margin-bottom-3",
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
                                text: "Go to ",
                              },
                              {
                                component: "url",
                                text: "Calculations",
                                href: {
                                  urlTemplate: "/cases/{caseId}/calculations",
                                  params: {
                                    caseId: "$._id",
                                  },
                                },
                                target: "_self",
                              },
                              {
                                component: "text",
                                text: " to view automated checks against the customer's land parcels and actions",
                              },
                            ],
                          },
                          {
                            component: "container",
                            items: [
                              {
                                component: "text",
                                text: "Check for failures and resolve these by:",
                              },
                              {
                                component: "unordered-list",
                                classes: "govuk-list govuk-list--bullet",
                                items: [
                                  {
                                    component: "text",
                                    text: "requesting information from the customer",
                                  },
                                  {
                                    component: "text",
                                    text: "running the calculations again",
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                    statusOptions: [
                      {
                        code: "ACCEPTED",
                        name: "Accept",
                        completes: true,
                      },
                      {
                        code: "RFI",
                        name: "Request information from customer",
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
                    name: "Check if any land parcels are within an SSSI",
                    mandatory: true,
                    description: [
                      {
                        component: "heading",
                        text: "Check if any land parcels are within a site of special scientific interest (SSSI)",
                        level: 2,
                        classes: "govuk-!-margin-bottom-3",
                      },
                      {
                        component: "container",
                        classes: "govuk-!-margin-bottom-6 govuk-body",
                        items: [
                          {
                            component: "text",
                            text: "You can find the land parcels listed in the ",
                          },
                          {
                            component: "url",
                            text: "Application",
                            href: {
                              urlTemplate: "/cases/{caseId}/case-details",
                              params: {
                                caseId: "$._id",
                              },
                            },
                            target: "_self",
                          },
                          {
                            component: "text",
                            text: ". You can check for SSSIs using SITI Agri or other data sources.",
                          },
                        ],
                      },
                      {
                        component: "heading",
                        text: "If no land parcels in this application are on an SSSI",
                        level: 3,
                        classes: "govuk-!-margin-bottom-4",
                      },
                      {
                        component: "paragraph",
                        text: "You can accept the details provided.",
                        classes: "govuk-!-margin-bottom-4",
                      },
                      {
                        component: "heading",
                        text: "If any land parcel is on an SSSI",
                        level: 3,
                        classes: "govuk-!-margin-bottom-4",
                      },
                      {
                        component: "paragraph",
                        text: "Confirm if a request for planned activity on an SSSI has been made. Consent does not have to be confirmed, only requested.",
                        classes: "govuk-!-margin-bottom-4",
                      },
                      {
                        component: "container",
                        classes: "govuk-!-margin-bottom-6 govuk-body",
                        items: [
                          {
                            component: "url",
                            text: "View SSSI request spreadsheet (opens in new tab)",
                            href: "https://defra.sharepoint.com/:x:/r/teams/Team1512/SFI%2024%20expanded%20offer/SSSI/SFI%2024%20Expanded%20offer%20SSSI%20Shared%20Spreadsheet%20V1.xlsm?d=wda46d49f73e44fdb8da1777b927c2b92&csf=1&web=1&e=FtxaTy",
                            target: "_blank",
                            rel: "noopener",
                          },
                        ],
                      },
                    ],
                    statusOptions: [
                      {
                        code: "ACCEPTED",
                        name: "Accept",
                        completes: true,
                      },
                      {
                        code: "RFI",
                        name: "Request information from customer",
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
                    code: "PAYMENT_AMOUNT_CHECK",
                    name: "Check payment amount",
                    mandatory: true,
                    description: [
                      {
                        component: "heading",
                        text: "Check payment amount",
                        level: 2,
                        classes: "govuk-!-margin-bottom-3",
                      },
                      {
                        component: "paragraph",
                        text: "To check payment amount: ",
                      },
                      {
                        component: "ordered-list",
                        classes:
                          "govuk-list govuk-list--number govuk-!-margin-bottom-6",
                        items: [
                          {
                            component: "container",
                            items: [
                              {
                                component: "text",
                                text: "Check the payment section of the ",
                              },
                              {
                                component: "url",
                                text: "Application",
                                href: {
                                  urlTemplate: "/cases/{caseId}/case-details",
                                  params: {
                                    caseId: "$._id",
                                  },
                                },
                                target: "_self",
                              },
                              {
                                component: "text",
                                text: " and make a note of the:",
                              },
                              {
                                component: "unordered-list",
                                classes: "govuk-list govuk-list--bullet",
                                items: [
                                  {
                                    component: "text",
                                    text: "hectares per funded action",
                                  },
                                  {
                                    component: "text",
                                    text: "annual payments per funded action",
                                  },
                                  {
                                    component: "text",
                                    text: "per hectare payment rate per funded action",
                                  },
                                ],
                              },
                            ],
                          },
                          {
                            component: "container",
                            items: [
                              {
                                component: "text",
                                text: "Search how much the funded action pays per hectare on ",
                              },
                              {
                                component: "url",
                                href: "https://www.gov.uk/find-funding-for-land-or-farms",
                                text: "Find funding for land or farms (opens in new tab)",
                                target: "_blank",
                                rel: "noopener",
                              },
                              {
                                component: "text",
                                text: " - check it matches the rate in the application",
                              },
                            ],
                          },
                          {
                            component: "text",
                            text: "Multiply the total hectares for each funded action by the payment rate per hectare",
                          },
                          {
                            component: "text",
                            text: "Check your figure matches the total yearly payment in the application",
                          },
                        ],
                      },
                    ],
                    statusOptions: [
                      {
                        code: "ACCEPTED",
                        name: "Accept",
                        completes: true,
                      },
                      {
                        code: "RFI",
                        name: "Request information from customer",
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
                    name: "Review scheme budget as a finance officer",
                    mandatory: true,
                    description: [
                      {
                        component: "heading",
                        text: "Review scheme budget as a finance officer",
                        level: 2,
                        classes: "govuk-!-margin-bottom-3",
                      },
                      {
                        component: "paragraph",
                        text: "You must check there is enough budget left for the total yearly payment the customer has applied for.",
                        classes: "govuk-body",
                      },
                      {
                        component: "table",
                        firstCellIsHeader: true,
                        rows: [
                          [
                            {
                              component: "text",
                              text: "Total yearly payment applied for",
                            },
                            {
                              component: "text",
                              text: "$.payload.answers.totalAnnualPaymentPence",
                              format: "penniesToPounds",
                            },
                          ],
                        ],
                      },
                    ],
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
                        name: "Request information from customer",
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
            name: "Tasks",
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
                      name: "Reject",
                      checkTasks: false,
                      comment: {
                        label: "Explain this decision",
                        helpText:
                          "You must include an explanation for auditing purposes.",
                        mandatory: true,
                      },
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
                      comment: {
                        label: "Explain this decision",
                        helpText:
                          "You must include an explanation for auditing purposes.",
                        mandatory: false,
                      },
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
                    description: [
                      {
                        component: "heading",
                        text: "Check funding agreement",
                        level: 2,
                        classes: "govuk-!-margin-bottom-3",
                      },
                      {
                        component: "container",
                        classes: "govuk-!-margin-bottom-6 govuk-body",
                        items: [
                          {
                            component: "text",
                            text: "Check the ",
                          },
                          {
                            component: "url",
                            text: "agreement",
                            href: {
                              urlTemplate: "/cases/{caseId}/agreements",
                              params: {
                                caseId: "$._id",
                              },
                            },
                            target: "_self",
                          },
                          {
                            component: "text",
                            text: " is accurate.",
                          },
                        ],
                      },
                    ],
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
                    name: "Notify customer that agreement is ready",
                    mandatory: true,
                    description: [
                      {
                        component: "heading",
                        text: "Notify customer that agreement is ready",
                        level: 2,
                        classes: "govuk-!-margin-bottom-3",
                      },
                      {
                        component: "paragraph",
                        text: "Tell the customer their agreement is ready to review.",
                        classes: "govuk-!-margin-bottom-6",
                      },
                    ],
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
            beforeContent: [
              {
                renderIf:
                  "jsonata:$.request.params.tabId = 'tasks' and $.position.statusCode = 'AGREEMENT_OFFERED'",
                content: [
                  {
                    component: "alert",
                    variant: "success",
                    title: "Agreement sent",
                    text: "There is nothing more you need to do.",
                    showTitleAsHeading: true,
                  },
                  {
                    component: "paragraph",
                    text: "You can still withdraw the agreement until the customer has accepted or rejected.",
                  },
                  {
                    component: "heading",
                    text: "Agreement with customer for review",
                    level: 3,
                  },
                  {
                    component: "paragraph",
                    text: "There are no tasks to complete.",
                  },
                  {
                    component: "heading",
                    text: "You can still withdraw this agreement",
                    level: 3,
                  },
                  {
                    component: "paragraph",
                    text: "You may want to withdraw this agreement if:",
                  },
                  {
                    component: "unordered-list",
                    items: [
                      {
                        text: "the customer needs to update their application",
                      },
                      {
                        text: "the customer has not responded to the agreement offer within 10 working days",
                      },
                      {
                        text: "there is an error in the agreement",
                      },
                    ],
                  },
                ],
              },
            ],

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
