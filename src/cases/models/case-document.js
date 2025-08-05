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
    this.requiredRoles = props.requiredRoles;
    this.pages = props.pages;
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
          taskGroups: [
            {
              id: "stage-2-tasks",
              tasks: [
                {
                  id: "task-2",
                  status: "pending",
                },
              ],
            },
          ],
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
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
      pages: {
        details: {
          banner: {
            title: {
              ref: "$.payload.businessName",
              type: "string",
            },
            summary: {
              reference: {
                label: "Reference",
                ref: "$.caseRef",
                type: "string",
              },
              status: {
                label: "Status",
                ref: "$.status",
                type: "string",
              },
              dateReceived: {
                label: "Date Received",
                ref: "$.dateReceived",
                type: "date",
              },
            },
          },
          tabs: {
            caseDetails: {
              title: "Application",
              sections: [
                {
                  title: "Applicant Details",
                  type: "object",
                  component: "list",
                  fields: [
                    {
                      ref: "$.payload.answers.isPigFarmer",
                      type: "boolean",
                      label: "Are you a pig farmer?",
                    },
                  ],
                },
                {
                  title: "Pig Stock Details",
                  type: "object",
                  component: "list",
                  fields: [
                    {
                      ref: "$.payload.answers.totalPigs",
                      type: "number",
                      label: "Total Pigs",
                    },
                    {
                      ref: "$.payload.answers.whitePigsCount",
                      type: "number",
                      label: "How many White pigs do you have?",
                    },
                    {
                      ref: "$.payload.answers.britishLandracePigsCount",
                      type: "number",
                      label: "How many British Landrace pigs do you have?",
                    },
                    {
                      ref: "$.payload.answers.berkshirePigsCount",
                      type: "number",
                      label: "How many Berkshire pigs do you have?",
                    },
                    {
                      ref: "$.payload.answers.otherPigsCount",
                      type: "number",
                      label: "How many Other pigs do you have?",
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      ...props,
    });
  }
}
