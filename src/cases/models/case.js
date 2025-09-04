import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { path, setObjectPath } from "../../common/object-path.js";
import { assertIsComment, toComments } from "./comment.js";
import { EventEnums } from "./event-enums.js";
import { toTasks } from "./task.js";
import {
  assertIsTimelineEvent,
  TimelineEvent,
  toTimelineEvents,
} from "./timeline-event.js";

export class Case {
  constructor(props) {
    const comments = toComments(props.comments);
    const timeline = toTimelineEvents(props.timeline, comments);

    this._id = props._id || new ObjectId().toHexString();
    this.caseRef = props.caseRef;
    this.workflowCode = props.workflowCode;
    this.status = props.status;
    this.dateReceived = props.dateReceived;
    this.currentStage = props.currentStage;
    this.assignedUser = props.assignedUser || null;
    this.payload = props.payload;
    this.stages = props.stages;
    this.comments = comments;
    this.timeline = timeline;
    this.requiredRoles = props.requiredRoles;

    this.tasks = toTasks(this.stages);
  }

  get objectId() {
    return ObjectId.createFromHexString(this._id);
  }

  unassignUser({ text, createdBy }) {
    this.assignUser({
      assignedUserId: null,
      text,
      createdBy,
    });
  }

  /**
   *
   * @param {string} taskId
   * @returns task with given taskId or throws if task not found
   */
  findTask(taskId) {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw Boom.notFound(`Can not find Task with id ${taskId}!`);
    }

    return task;
  }

  findStage(stageId) {
    const stage = this.stages.find((s) => s.id === stageId);
    if (!stage) {
      throw Boom.notFound(`Can not find Stage with id ${stageId}`);
    }

    return stage;
  }

  findComment(commentRef) {
    return this.comments.find((c) => c.ref === commentRef);
  }

  setTaskStatus({ stageId, taskGroupId, taskId, status, comment, updatedBy }) {
    const caseTask = this.findTask(taskId);

    caseTask.updateStatus(status, updatedBy);

    if (status === "complete") {
      const timelineEvent = TimelineEvent.createTaskCompleted({
        createdBy: updatedBy,
        text: comment,
        data: {
          caseId: this._id,
          stageId,
          taskGroupId,
          taskId,
        },
      });

      this.#addTimelineEvent(timelineEvent);
      caseTask.updateCommentRef(timelineEvent.comment?.ref);
    }
  }

  assignUser({ assignedUserId, createdBy, text }) {
    const eventType = assignedUserId
      ? EventEnums.eventTypes.CASE_ASSIGNED
      : EventEnums.eventTypes.CASE_UNASSIGNED;

    const timelineEvent = TimelineEvent.createAssignUser({
      eventType,
      text,
      data: {
        assignedTo: assignedUserId,
        previouslyAssignedTo: this.assignedUser?.id,
      },
      createdBy,
    });

    this.#setAssignedUser(assignedUserId);
    this.#addTimelineEvent(timelineEvent);
  }

  addNote({ text, createdBy }) {
    if (!text?.trim()) {
      throw Boom.badRequest(`Note text is required and cannot be empty.`);
    }

    const timelineEvent = TimelineEvent.createNoteAdded({
      text,
      createdBy,
    });
    this.#addTimelineEvent(timelineEvent);
    return timelineEvent.comment;
  }

  addAgreementToPhaseStage({ newStatus, supplementaryData }) {
    const { phase, stage, targetNode, data } = supplementaryData;
    const { agreementRef, createdAt, agreementStatus } = data;
    const nodeData = {
      agreementRef,
      createdAt,
      agreementStatus,
    };
    this.status = newStatus;

    // checks to see if path exists... if not, creates it and sets data
    if (path(this, "phases", phase, "stages", stage, targetNode)) {
      this.phases[phase].stages[stage][targetNode].push(nodeData);
    } else {
      setObjectPath(
        this,
        [nodeData],
        "phases",
        phase,
        "stages",
        stage,
        targetNode,
      );
    }
  }

  updateStageOutcome({ actionId, comment, createdBy }) {
    const timelineEvent = TimelineEvent.createStageCompleted({
      data: {
        actionId,
        stageId: this.currentStage,
      },
      text: comment,
      createdBy,
    });

    const currentStage = this.#getCurrentStage();

    currentStage.outcome = {
      actionId,
      createdBy,
      createdAt: new Date().toISOString(),
    };

    if (timelineEvent.comment) {
      currentStage.outcome.commentRef = timelineEvent.comment.ref;
    }

    this.#addTimelineEvent(timelineEvent);

    if (actionId === "approve") {
      this.#moveToNextStage();
    }
  }

  getUserIds() {
    const caseUserIds = this.assignedUser ? [this.assignedUser.id] : [];

    const timelineUserIds = this.timeline.flatMap((event) =>
      event.getUserIds(),
    );

    const commentUserIds = this.comments.flatMap((comment) =>
      comment.getUserIds(),
    );

    const taskUserIds = this.stages
      .flatMap((stage) =>
        stage.taskGroups.flatMap((taskGroup) =>
          taskGroup.tasks.flatMap((t) => t.updatedBy),
        ),
      )
      .filter((id) => id !== undefined);

    const allUserIds = [
      ...caseUserIds,
      ...timelineUserIds,
      ...commentUserIds,
      ...taskUserIds,
    ];

    return [...new Set(allUserIds)];
  }

  #setAssignedUser(userId) {
    this.assignedUserId = userId;
    this.assignedUser = userId ? { id: userId } : null;
  }

  #addTimelineEvent(timelineEvent) {
    assertIsTimelineEvent(timelineEvent);
    this.timeline.unshift(timelineEvent);

    if (timelineEvent.comment) {
      this.#addComment(timelineEvent.comment);
    }

    return timelineEvent;
  }

  #addComment(comment) {
    assertIsComment(comment);
    this.comments.unshift(comment);
    return comment;
  }

  #getCurrentStage() {
    const currentStageIndex = this.#getCurrentStageIndex();
    return this.stages[currentStageIndex];
  }

  #moveToNextStage() {
    const nextStage = this.#getNextStage();
    this.currentStage = nextStage.id;
    return nextStage;
  }

  #getNextStage() {
    const currentStageIndex = this.#getCurrentStageIndex();
    const currentStage = this.#getCurrentStage();

    if (currentStageIndex === this.stages.length - 1) {
      throw Boom.notFound(
        `Cannot progress case ${this._id} from stage ${this.currentStage}, no more stages to progress to`,
      );
    }

    const allTasksComplete = currentStage.taskGroups
      .flatMap((group) => group.tasks)
      .every((task) => task.status === "complete");

    if (!allTasksComplete) {
      throw Boom.badRequest(
        `Cannot progress case ${this._id} from stage ${this.currentStage} - some tasks are not complete.`,
      );
    }

    return this.stages[currentStageIndex + 1];
  }

  #getCurrentStageIndex() {
    const currentStageIndex = this.stages.findIndex(
      (stage) => stage.id === this.currentStage,
    );

    if (currentStageIndex === -1) {
      throw Boom.notFound(
        `Cannot find current stage index for ${this.currentStage}, case ${this._id}`,
      );
    }

    return currentStageIndex;
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
      comments: caseEvent.comments,
      timeline: [
        {
          eventType: EventEnums.eventTypes.CASE_CREATED,
          createdBy: "System", // To specify that the case was created by an external system
          data: {
            caseRef: caseEvent.clientRef,
          },
        },
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
          eventType: EventEnums.eventTypes.CASE_CREATED,
          createdAt: "2025-01-01T00:00:00.000Z",
          description: "Case received",
          // 'createdBy' is hydrated on find-case-by-id
          createdBy: "System", // To specify that the case was created by an external system
          data: {
            caseRef: "case-ref",
          },
        },
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
