import { ObjectId } from "mongodb";

export class Workflow {
  constructor(props) {
    this._id = props._id || new ObjectId().toHexString();
    this.code = props.code;
    this.pages = props.pages;
    this.stages = props.stages;
    this.requiredRoles = props.requiredRoles;
  }

  static createMock(props) {
    return new Workflow({
      code: "workflow-code",
      pages: {
        cases: {
          details: {
            banner: {
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
                    type: "list",
                    fields: [
                      {
                        ref: "$.payload.answers.field1",
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
      },
      stages: [
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
      ],
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
      ...props,
    });
  }
}
