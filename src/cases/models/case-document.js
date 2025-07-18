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
    this.assignedUserId = props.assignedUser?.id || null;
    this.currentStage = props.currentStage;
    this.timeline = props.timeline;
    this.stages = props.stages;
    this.timeline = props.timeline;
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
                  status: "pending",
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
      timeline: [
        {
          eventType: "CASE_CREATED",
          createdAt: "2025-01-01T00:00:00.000Z",
          description: "Case received",
          // 'createdBy' is hydrated to full user details on find
          createdBy: "System", // To specify that the case was created by an external system
          data: {
            caseRef: "case-ref",
          },
        },
      ],
      assignedUser: {
        id: "64c88faac1f56f71e1b89a33",
        name: "User Name",
      },
      ...props,
    });
  }
}
