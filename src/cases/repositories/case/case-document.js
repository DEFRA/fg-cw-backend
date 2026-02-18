import { ObjectId } from "mongodb";
import { Position } from "../../models/position.js";
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
    this.currentPhase = props.position.phaseCode;
    this.currentStage = props.position.stageCode;
    this.currentStatus = props.position.statusCode;
    this.createdAt = new Date(props.createdAt);
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
      position: new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "STATUS_1",
      }),
      createdAt: "2025-01-01T00:00:00.000Z",
      supplementaryData: {},
      payload: {},
      phases: [
        new PhaseDocument({
          code: "PHASE_1",
          stages: [
            new StageDocument({
              code: "STAGE_1",
              taskGroups: [
                new TaskGroupDocument({
                  code: "TASK_GROUP_1",
                  tasks: [
                    new TaskDocument({
                      code: "TASK_1",
                      status: "PENDING",
                      completed: false,
                    }),
                  ],
                }),
              ],
            }),
            new StageDocument({
              code: "STAGE_2",
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
