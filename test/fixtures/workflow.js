export const workflowData1 = {
  code: "frps-private-beta",
  pages: {
    cases: {
      details: {
        banner: {
          title: {
            ref: "$.payload.businessName",
            type: "string",
          },
          summary: {
            sbi: {
              label: "SBI",
              ref: "$.payload.identifiers.sbi",
              type: "string",
            },
            clientReference: {
              label: "Client Reference",
              ref: "$.payload.clientRef",
              type: "string",
            },
          },
        },
        tabs: {
          caseDetails: {
            title: "Application",
            sections: [
              {
                title: "Details",
                type: "object",
                component: "list",
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
                ],
              },
            ],
          },
        },
      },
    },
  },
  stages: [
    {
      id: "application-receipt",
      title: "Application Receipt",
      taskGroups: [
        {
          id: "application-receipt-tasks",
          title: "Application Receipt tasks",
          tasks: [
            {
              id: "simple-review",
              title: "Simple Review",
              type: "boolean",
            },
          ],
        },
      ],
      actions: [
        {
          id: "approve",
          label: "Approve",
        },
      ],
    },
    {
      id: "contract",
      title: "Stage for contract management",
      taskGroups: [],
      actions: [],
    },
  ],
  requiredRoles: {
    allOf: ["ROLE_1", "ROLE_2"],
    anyOf: ["ROLE_3"],
  },
};

export const workflowData2 = {
  code: "grant-ref-2",
  pages: {
    cases: {
      details: {
        banner: {
          title: {
            ref: "$.payload.businessName",
            type: "string",
          },
          summary: {
            clientReference: {
              label: "Client Reference",
              ref: "$.payload.clientRef",
              type: "string",
            },
          },
        },
        tabs: {
          caseDetails: {
            title: "Application",
            sections: [
              {
                title: "Details",
                type: "object",
                component: "list",
                fields: [
                  {
                    ref: "$.payload.answers.scheme",
                    type: "string",
                    label: "Scheme",
                  },
                ],
              },
            ],
          },
        },
      },
    },
  },
  stages: [
    {
      id: "review",
      title: "Review",
      taskGroups: [],
      actions: [],
    },
    {
      id: "decision",
      title: "Decision",
      taskGroups: [],
      actions: [],
    },
  ],
  requiredRoles: {
    allOf: ["ROLE_1", "ROLE_2"],
    anyOf: ["ROLE_3"],
  },
};
