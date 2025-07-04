import { ObjectId } from "mongodb";

export class WorkflowDocument {
  constructor(props) {
    this._id = props._id
      ? ObjectId.createFromHexString(props._id)
      : new ObjectId();

    this.code = props.code;
    this.payloadDefinition = props.payloadDefinition;
    this.stages = props.stages;
    this.requiredRoles = props.requiredRoles;
  }

  static createMock(props) {
    return new WorkflowDocument({
      code: "workflow-code",
      payloadDefinition: {
        $id: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
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
