import { ObjectId } from "mongodb";

export class Case {
  constructor(props) {
    this._id = props._id;
    this.caseRef = props.caseRef;
    this.workflowCode = props.workflowCode;
    this.status = props.status;
    this.dateReceived = props.dateReceived;
    this.priority = props.priority;
    this.payload = props.payload;
    this.currentStage = props.currentStage;
    this.stages = props.stages;
  }

  static fromWorkflow(workflow, caseEvent) {
    return new Case({
      _id: new ObjectId().toString(),
      caseRef: caseEvent.clientRef,
      workflowCode: workflow.code,
      status: "NEW",
      dateReceived: new Date().toISOString(),
      priority: "LOW",
      payload: structuredClone(caseEvent),
      currentStage: workflow.stages[0].id,
      stages: workflow.stages.map((stage) => ({
        id: stage.id,
        taskGroups: stage.taskGroups.map((taskGroup) => ({
          id: taskGroup.id,
          tasks: taskGroup.tasks.map((task) => ({
            id: task.id,
            isComplete: false,
          })),
        })),
      })),
    });
  }

  static createMock(props) {
    const defaultProps = Object.assign(
      {
        _id: new ObjectId().toString(),
        workflowCode: "frps-private-beta",
        caseRef: "APPLICATION-REF-1",
        status: "NEW",
        dateReceived: "2025-03-27T11:34:52.000Z",
        targetDate: "2025-04-27T11:34:52.000Z",
        priority: "MEDIUM",
        assignedUser: "Mark Ford",
        payload: {
          clientRef: "APPLICATION-REF-1",
          code: "frps-private-beta",
          createdAt: "2025-03-27T10:34:52.000Z",
          submittedAt: "2025-03-28T11:30:52.000Z",
          identifiers: {
            sbi: "SBI001",
            frn: "FIRM0001",
            crn: "CUST0001",
            defraId: "DEFRA0001",
          },
          answers: {
            agreementName: "Test application name",
            scheme: "SFI",
            year: 2025,
            hasCheckedLandIsUpToDate: true,
            actionApplications: [
              {
                parcelId: "9238",
                sheetId: "SX0679",
                code: "CSAM1",
                appliedFor: {
                  unit: "ha",
                  quantity: 20.23,
                },
              },
            ],
          },
        },
        currentStage: "application-receipt",
        stages: [
          {
            id: "application-receipt",
            taskGroups: [
              {
                id: "application-receipt-tasks",
                tasks: [
                  {
                    id: "simple-review",
                    isComplete: false,
                  },
                ],
              },
            ],
          },
          {
            id: "contract",
            taskGroups: [],
          },
        ],
      },
      props,
    );

    return new Case(defaultProps);
  }
}
