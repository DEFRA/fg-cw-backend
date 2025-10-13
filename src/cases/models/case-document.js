import { ObjectId } from "mongodb";
import { TaskDocument } from "./task-document.js";
import { TimelineEventDocument } from "./timeline-event-document.js";

const processTask = ({ id }, tasks) => {
  const task = tasks.get(id);
  return new TaskDocument(task);
};

const mapTasksToStages = (kaseStages, tasks) => {
  if (!tasks) {
    return kaseStages;
  }

  const stages = kaseStages.map((s) => {
    return {
      code: s.code,
      outcome: s.outcome || null,
      taskGroups: s.taskGroups.map((tg) => {
        return {
          id: tg.id,
          tasks: tg.tasks.map((t) => processTask(t, tasks)),
        };
      }),
    };
  });
  return stages;
};

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
    this.stages = mapTasksToStages(props.stages, props.tasks);
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
      status: "NEW",
      dateReceived: "2025-01-01T00:00:00.000Z",
      supplementaryData: {},
      payload: {},
      currentStage: "stage-1",
      stages: [
        {
          code: "stage-1",
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
          code: "stage-2",
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
      comments: [],
      assignedUser: {
        id: "64c88faac1f56f71e1b89a33",
        name: "User Name",
      },
      ...props,
    });
  }
}
