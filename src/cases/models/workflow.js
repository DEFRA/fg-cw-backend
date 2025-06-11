import { ObjectId } from "mongodb";

export class Workflow {
  constructor(props) {
    this._id = props._id || new ObjectId().toHexString();
    this.code = props.code;
    this.payloadDefinition = props.payloadDefinition;
    this.stages = props.stages;
  }

  static createMock(props) {
    return new Workflow({
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
      ...props,
    });
  }
}
