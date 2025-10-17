export const createWorkflowMockData = () => ({
  code: "workflow-code",
  pages: createPages(),
  stages: createStages(),
  requiredRoles: createRequiredRoles(),
  definitions: {
    key1: "value1",
  },
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
            text: "$.caseRef",
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
              rows: [
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
    code: "stage-1",
    name: "Stage 1",
    description: "Stage 1 description",
    taskGroups: [
      {
        code: "task-group-1",
        name: "Task group 1",
        description: "Task group description",
        tasks: [
          {
            code: "task-1",
            name: "Task 1",
            type: "boolean",
            description: "Task 1 description",
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
    code: "stage-2",
    name: "Stage 2",
    description: "Stage 2 description",
    taskGroups: [],
    actions: [],
  },
  {
    code: "stage-3",
    name: "Stage 3",
    description: "Stage 3 description",
    taskGroups: [],
    actions: [],
  },
];

const createRequiredRoles = () => ({
  allOf: ["ROLE_1", "ROLE_2"],
  anyOf: ["ROLE_3"],
});
