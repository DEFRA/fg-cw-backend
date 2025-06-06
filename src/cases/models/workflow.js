import { ObjectId } from "mongodb";

export class Workflow {
  constructor({ _id, code, payloadDefinition, stages }) {
    this._id = _id;
    this.code = code;
    this.payloadDefinition = payloadDefinition;
    this.stages = stages;
  }

  static createMock(props) {
    const defaultProps = Object.assign(
      {
        _id: new ObjectId().toString(),
        code: "workflow-code",
        payloadDefinition: {
          $id: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
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
      },
      props,
    );

    return new Workflow(defaultProps);
  }
}
