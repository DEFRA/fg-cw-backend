import { ObjectId } from "mongodb";
import { getAuthenticatedUser } from "../../common/auth.js";
import {
  assertIsComment,
  assertIsCommentsArray,
  Comment,
  toComment,
} from "./comment.js";
import { EventEnums } from "./event-enums.js";
import { assertIsTimelineEvent, TimelineEvent } from "./timeline-event.js";

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
    this.comments = assertIsCommentsArray(props.comments);
    this.timeline = props.timeline || [];
    this.requiredRoles = props.requiredRoles;
  }

  get objectId() {
    return ObjectId.createFromHexString(this._id);
  }

  get previousUserId() {
    return this.assignedUser?.id;
  }

  setAssignedUser(userId) {
    this.assignedUserId = userId;
    this.assignedUser = userId ? { id: userId } : null;
  }

  findTask(stageId, taskGroupId, taskId) {
    const stage = this.stages.find((s) => s.id === stageId);
    const taskGroup = stage?.taskGroups.find((tg) => tg.id === taskGroupId);
    const task = taskGroup?.tasks.find((t) => t.id === taskId);
    return task;
  }

  updateTaskStatus(stageId, taskGroupId, taskId, status, note) {
    const type = EventEnums.eventTypes.TASK_COMPLETED;
    const authenticatedUserId = getAuthenticatedUser().id;
    const comment = Comment.createOptionalComment(
      note,
      type,
      authenticatedUserId,
    );

    const task = this.findTask(stageId, taskGroupId, taskId);

    if (comment) {
      this.addComment(comment);
      task.commentRef = comment.ref;
    }

    task.status = status;

    if (status === "complete") {
      const timelineEvent = TimelineEvent.createTimelineEvent(
        type,
        authenticatedUserId,
        {
          caseId: this._id,
          stageId,
          taskGroupId,
          taskId,
        },
        comment?.ref,
      );

      this.addTimelineEvent(timelineEvent);
    }
  }

  assignUser(userId, authenticatedUserId, note) {
    const type = userId
      ? EventEnums.eventTypes.CASE_ASSIGNED
      : EventEnums.eventTypes.CASE_UNASSIGNED;

    const comment = Comment.createOptionalComment(
      note,
      type,
      authenticatedUserId,
    );

    if (comment) {
      this.addComment(comment);
    }

    const previousUserId = this.previousUserId;

    const timelineEvent = TimelineEvent.createTimelineEvent(
      type,
      authenticatedUserId,
      {
        assignedTo: userId,
        previouslyAssignedTo: previousUserId,
      },
      comment?.ref,
    );

    this.setAssignedUser(userId);
    this.addTimelineEvent(timelineEvent);
  }

  addComment(comment) {
    assertIsComment(comment);
    this.comments.unshift(comment);
    return comment;
  }

  addTimelineEvent(timelineEvent) {
    assertIsTimelineEvent(timelineEvent);
    this.timeline.unshift(timelineEvent);
    return timelineEvent;
  }

  getUserIds() {
    const caseUserIds = this.assignedUser ? [this.assignedUser.id] : [];

    const timelineUserIds = this.timeline.flatMap((event) =>
      event.getUserIds(),
    );

    const commentUserIds = this.comments.flatMap((comment) =>
      comment.getUserIds(),
    );

    const allUserIds = [...caseUserIds, ...timelineUserIds, ...commentUserIds];

    return [...new Set(allUserIds)];
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
      comments: caseEvent.comments?.map(toComment) || [],
      timeline: [
        new TimelineEvent({
          eventType: EventEnums.eventTypes.CASE_CREATED,
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
        TimelineEvent.createMock({
          eventType: EventEnums.eventTypes.CASE_CREATED,
          createdAt: "2025-01-01T00:00:00.000Z",
          description: "Case received",
          // 'createdBy' is hydrated on find-case-by-id
          createdBy: "System", // To specify that the case was created by an external system
          data: {
            caseRef: "case-ref",
          },
        }),
      ],
      comments: [],
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
