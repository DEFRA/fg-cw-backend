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
      ...payload,
    },
  });

  return response.payload;
};
