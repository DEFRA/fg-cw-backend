import { ObjectId } from "mongodb";
import { PhaseDocument } from "./phase-document.js";
import { StageDocument } from "./stage-document.js";
import { TaskDocument } from "./task-document.js";
import { TaskGroupDocument } from "./task-group-document.js";
import { TimelineEventDocument } from "./timeline-event-document.js";

export class CaseDocument {
  constructor(props) {
    this._id = props._id
      ? ObjectId.createFromHexString(props._id)
      : new ObjectId();
    this.caseRef = props.caseRef;
    this.workflowCode = props.workflowCode;
    this.currentPhase = props.currentPhase;
    this.currentStage = props.currentStage;
    this.currentStatus = props.currentStatus;
    this.dateReceived = new Date(props.dateReceived);
    this.payload = props.payload;
    this.assignedUserId = props.assignedUser?.id || null;
    this.phases = props.phases.map((phase) => new PhaseDocument(phase));
    this.comments = props.comments;
    this.timeline = props.timeline.map(
      (timelineProps) => new TimelineEventDocument(timelineProps),
    );
    this.supplementaryData = props.supplementaryData;
  }

  static createMock(props) {
    return new CaseDocument({
      workflowCode: "workflow-code",
      caseRef: "case-ref",
      currentPhase: "phase-1",
      currentStage: "stage-1",
      currentStatus: "NEW",
      dateReceived: "2025-01-01T00:00:00.000Z",
      supplementaryData: {},
      payload: {},
      phases: [
        new PhaseDocument({
          code: "phase-1",
          stages: [
            new StageDocument({
              code: "stage-1",
              taskGroups: [
                new TaskGroupDocument({
                  code: "task-group-1",
                  tasks: [
                    new TaskDocument({
                      code: "task-1",
                      status: "pending",
                    }),
                  ],
                }),
              ],
            }),
            new StageDocument({
              code: "stage-2",
              taskGroups: [],
            }),
          ],
        }),
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
      comments: [],
      assignedUser: {
        id: "64c88faac1f56f71e1b89a33",
      },
      ...props,
    });
  }
}
