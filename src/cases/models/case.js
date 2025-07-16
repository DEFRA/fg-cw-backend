import { ObjectId } from "mongodb";
import { TimelineEvent } from "./timeline-event.js";

export class Case {
  constructor(props) {
    this._id = props._id || new ObjectId().toHexString();
    this.caseRef = props.caseRef;
    this.workflowCode = props.workflowCode;
    this.status = props.status;
    this.dateReceived = props.dateReceived;
    this.currentStage = props.currentStage;
    this.assignedUser = props.assignedUser || null;
    this.payload = props.payload;
    this.stages = props.stages;
    this.timeline = props.timeline || [];
    this.requiredRoles = props.requiredRoles;
  }

  static fromWorkflow(workflow, caseEvent) {
    return new Case({
      caseRef: caseEvent.clientRef,
      workflowCode: workflow.code,
      status: "NEW",
      dateReceived: new Date().toISOString(),
      currentStage: workflow.stages[0].id,
      payload: caseEvent,
      stages: workflow.stages.map((stage) => ({
        id: stage.id,
        taskGroups: stage.taskGroups.map((taskGroup) => ({
          id: taskGroup.id,
          tasks: taskGroup.tasks.map((task) => ({
            id: task.id,
            status: "pending",
          })),
        })),
      })),
      timeline: [
        new TimelineEvent({
          eventType: TimelineEvent.eventTypes.CASE_CREATED,
          createdBy: "System", // To specify that the case was created by an external system
          data: {
            caseRef: caseEvent.clientRef,
          },
        }),
      ],
      requiredRoles: workflow.requiredRoles,
    });
  }

  static createMock(props) {
    return new Case({
      caseRef: "case-ref",
      workflowCode: "workflow-code",
      status: "NEW",
      dateReceived: "2025-01-01T00:00:00.000Z",
      currentStage: "stage-1",
      payload: {},
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
          eventType: TimelineEvent.eventTypes.CASE_CREATED,
          createdAt: "2025-01-01T00:00:00.000Z",
          description: "Case received",
          // 'createdBy' is hydrated on find-case-by-id
          createdBy: "System", // To specify that the case was created by an external system
          data: {
            caseRef: "case-ref",
          },
        },
      ],
      assignedUser: {
        id: "64c88faac1f56f71e1b89a33",
        name: "Test Name",
      },
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
      ...props,
    });
  }
}
