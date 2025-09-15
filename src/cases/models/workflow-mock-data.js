export const createWorkflowMockData = () => ({
  code: "workflow-code",
  pages: createPages(),
  stages: createStages(),
  requiredRoles: createRequiredRoles(),
});

const createPages = () => ({
  cases: {
    details: {
      banner: {
        title: {
          text: "$.payload.businessName",
          type: "string",
        },
        summary: {
          clientReference: {
            text: "$.payload.clientRef",
            label: "Client Reference",
            type: "string",
          },
        },
      },
      tabs: {
        "case-details": {
          content: [
            {
              title: "Details",
              type: "object",
              component: "list",
              fields: [
                {
                  text: "$.payload.answers.field1",
                  type: "string",
                  label: "Field 1",
                },
              ],
            },
          ],
        },
      },
    },
  },
});

const createStages = () => [
  {
    id: "stage-1",
    title: "Stage 1",
    taskGroups: [
      {
        id: "stage-1-tasks",
        title: "Stage 1 Tasks",
        tasks: [
          {
            id: "task-1",
            title: "Task 1",
            type: "boolean",
          },
        ],
      },
    ],
    actions: [
      {
        id: "action-1",
        label: "Action 1",
      },
    ],
  },
  {
    id: "stage-2",
    title: "Stage 2",
    taskGroups: [],
    actions: [],
  },
];

const createRequiredRoles = () => ({
  allOf: ["ROLE_1", "ROLE_2"],
  anyOf: ["ROLE_3"],
});
