import { ObjectId } from "mongodb";

export class CaseDocument {
  constructor(props) {
    this._id = props._id
      ? ObjectId.createFromHexString(props._id)
      : new ObjectId();

    this.caseRef = props.caseRef;
    this.workflowCode = props.workflowCode;
    this.status = props.status;
    this.dateReceived = new Date(props.dateReceived);
    this.payload = props.payload;
    this.currentStage = props.currentStage;
    this.stages = props.stages;
  }

  static createMock(props) {
    return new CaseDocument({
      workflowCode: "workflow-code",
      caseRef: "case-ref",
      status: "NEW",
      dateReceived: "2025-01-01T00:00:00.000Z",
      payload: {},
      currentStage: "stage-1",
      stages: [
        {
          id: "stage-1",
          taskGroups: [
            {
              id: "stage-1-tasks",
              tasks: [
                {
                  id: "task-1",
                  isComplete: false,
                },
              ],
            },
          ],
        },
        {
          id: "stage-2",
          taskGroups: [],
        },
      ],
      ...props,
    });
  }
}
