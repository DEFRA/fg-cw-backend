import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { logger } from "../../common/logger.js";
import { CasePhase } from "./case-phase.js";
import { CaseStage } from "./case-stage.js";
import { CaseTaskGroup } from "./case-task-group.js";
import { CaseTask } from "./case-task.js";
import { assertIsComment, Comment, toComments } from "./comment.js";
import { EventEnums } from "./event-enums.js";
import { Position } from "./position.js";
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
    this.dateReceived = props.dateReceived;
    this.position = props.position;
    this.assignedUser = props.assignedUser || null;
    this.payload = props.payload;
    this.phases = props.phases;
    this.comments = comments;
    this.timeline = timeline;
    this.supplementaryData = props.supplementaryData || {};
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

  findPhase(phaseCode) {
    const phase = this.phases.find((p) => p.code === phaseCode);

    if (!phase) {
      throw Boom.notFound(
        `Case with caseRef ${this.caseRef} and workflowCode ${this.workflowCode} does not have a phase with code ${phaseCode}`,
      );
    }

    return phase;
  }

  getStage() {
    return this.phases
      .find((p) => p.code === this.position.phaseCode)
      .findStage(this.position.stageCode);
  }

  findComment(commentRef) {
    return this.comments.find((c) => c.ref === commentRef);
  }

  setTaskStatus({
    taskGroupCode,
    taskCode,
    status,
    completed,
    comment,
    updatedBy,
  }) {
    const task = this.getStage()
      .findTaskGroup(taskGroupCode)
      .findTask(taskCode);

    const eventType = completed
      ? EventEnums.eventTypes.TASK_COMPLETED
      : EventEnums.eventTypes.TASK_UPDATED;

    const optionalComment = Comment.createOptionalComment({
      type: eventType,
      text: comment,
      createdBy: updatedBy,
    });

    const timelineEvent = new TimelineEvent({
      eventType,
      data: {
        caseId: this._id,
        phaseCode: this.position.phaseCode,
        stageCode: this.position.stageCode,
        taskGroupCode,
        taskCode: task.code,
      },
      comment: optionalComment,
      createdBy: updatedBy,
    });

    task.updateStatus({
      status,
      completed,
      updatedBy,
      comment: optionalComment,
    });

    this.#addTimelineEvent(timelineEvent);
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

  addExternalActionTimelineEvent({ actionName, createdBy }) {
    const timelineEvent = TimelineEvent.createExternalActionTriggered({
      actionName,
      createdBy,
    });
    this.#addTimelineEvent(timelineEvent);
  }

  getSupplementaryDataNode(targetNode, dataType) {
    if (this.supplementaryData[targetNode]) {
      return this.supplementaryData[targetNode];
    }

    this.supplementaryData[targetNode] = dataType === "ARRAY" ? [] : {};
    return this.supplementaryData[targetNode];
  }

  updateSupplementaryData({ targetNode, key, dataType, data }) {
    if (!targetNode) {
      return null;
    }

    const targetData = this.getSupplementaryDataNode(targetNode, dataType);

    if (dataType === "ARRAY") {
      const updated = this.updateSupplementaryDataArray({
        targetData,
        key,
        data,
      });

      return this.addSupplementaryData(targetNode, updated);
    } else if (dataType === "OBJECT") {
      const updated = this.updateSupplementaryDataObject({
        targetNode,
        targetData,
        key,
        data,
      });
      return this.addSupplementaryData(targetNode, updated);
    } else {
      return null;
    }
  }

  updateSupplementaryDataObject({ targetData, key, data, targetNode }) {
    if (!key) {
      throw new Error(
        `Can not update supplementaryData "${targetNode}" as an object without a key`,
      );
    }
    targetData[data[key]] = data;
    return targetData;
  }

  updateSupplementaryDataArray({ targetData, key, data }) {
    const inArray = !!key && !!targetData.find((d) => d[key] === data[key]);

    if (inArray) {
      return targetData.reduce((acc, c) => {
        if (c[key] === data[key]) {
          acc.push(data);
        } else {
          acc.push(c);
        }
        return acc;
      }, []);
    } else {
      targetData.push(data);
      return targetData;
    }
  }

  addSupplementaryData(targetNode, data) {
    this.supplementaryData[targetNode] = data;
  }

  updateStageOutcome({ workflow, actionCode, comment, createdBy }) {
    const position = workflow.getNextPosition(this.position, actionCode);

    if (this.position.equals(position)) {
      logger.warn(
        `Case with caseRef ${this.caseRef} and workflowCode ${this.workflowCode} is already at position ${this.position}`,
      );
      return;
    }

    if (!this.#canPerformAction(workflow, actionCode)) {
      throw Boom.preconditionFailed(
        `Cannot perform action ${actionCode} from position ${this.position}: required tasks are not complete`,
      );
    }

    const timelineEvent = TimelineEvent.createStageCompleted({
      data: {
        actionCode,
        phaseCode: this.position.phaseCode,
        stageCode: this.position.stageCode,
        statusCode: this.position.statusCode,
      },
      text: comment,
      createdBy,
    });

    const currentStage = this.getStage();

    currentStage.outcome = {
      actionCode,
      createdBy,
      createdAt: new Date().toISOString(),
    };

    if (timelineEvent.comment) {
      currentStage.outcome.commentRef = timelineEvent.comment.ref;
    }

    this.#addTimelineEvent(timelineEvent);

    this.position = position;
  }

  // eslint-disable-next-line complexity
  progressTo({ position, workflow, createdBy }) {
    if (this.position.equals(position)) {
      logger.warn(
        `Case with caseRef ${this.caseRef} and workflowCode ${this.workflowCode} is already at position ${this.position}`,
      );
      return;
    }

    const transition = workflow.getTransitionForTargetPosition(
      this.position,
      position,
    );

    if (!transition) {
      throw Boom.preconditionFailed(
        `Case with ${this.caseRef} and workflowCode ${this.workflowCode} cannot transition from ${this.position} to ${position}: transition does not exist`,
      );
    }

    if (transition.checkTasks && !this.#areTasksComplete(workflow)) {
      throw Boom.preconditionFailed(
        `Case with ${this.caseRef} and workflowCode ${this.workflowCode} cannot transition from ${this.position} to ${position}: all mandatory tasks must be completed`,
      );
    }

    if (!this.position.isSamePhase(position)) {
      this.#addTimelineEvent(
        TimelineEvent.createPhaseCompleted({
          data: {
            phaseCode: this.position.phaseCode,
          },
          createdBy,
        }),
      );
    }

    if (!this.position.isSameStage(position)) {
      const timelineEvent = TimelineEvent.createStageCompleted({
        data: {
          actionCode: null,
          phaseCode: this.position.phaseCode,
          stageCode: this.position.stageCode,
          statusCode: this.position.statusCode,
        },
        text: null,
        createdBy,
      });

      this.#addTimelineEvent(timelineEvent);
    }

    this.#addTimelineEvent(
      TimelineEvent.createCaseStatusChanged({
        data: {
          phaseCode: position.phaseCode,
          stageCode: position.stageCode,
          statusCode: position.statusCode,
        },
        createdBy,
      }),
    );

    this.position = position;
  }

  #areTasksComplete(workflow) {
    const workflowStage = workflow.getStage(this.position);
    const caseStage = this.getStage();

    return caseStage.areTasksComplete(workflowStage);
  }

  #canPerformAction(workflow, actionCode) {
    const workflowStage = workflow.getStage(this.position);
    const action = workflowStage.getActionByCode(this.position, actionCode);

    if (!action) {
      throw Boom.notFound(
        `Action with code ${actionCode} not found for position ${this.position}`,
      );
    }

    if (!action.checkTasks) {
      return true;
    }

    return this.#areTasksComplete(workflow);
  }

  getPermittedActions(workflow) {
    const workflowStage = workflow.getStage(this.position);
    const areTasksComplete = this.#areTasksComplete(workflow);

    return workflowStage
      .getActions(this.position)
      .filter((a) => !a.checkTasks || areTasksComplete);
  }

  getUserIds() {
    const caseUserIds = this.assignedUser ? [this.assignedUser.id] : [];

    const timelineUserIds = this.timeline.flatMap((event) =>
      event.getUserIds(),
    );

    const commentUserIds = this.comments.flatMap((comment) =>
      comment.getUserIds(),
    );

    const taskUserIds = this.phases.flatMap((phase) => phase.getUserIds());

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

  static new({ caseRef, workflowCode, position, payload, phases }) {
    return new Case({
      caseRef,
      workflowCode,
      position,
      dateReceived: new Date().toISOString(),
      payload,
      supplementaryData: {},
      timeline: [
        new TimelineEvent({
          eventType: EventEnums.eventTypes.CASE_CREATED,
          createdBy: "System",
          data: {
            caseRef,
          },
        }),
      ],
      phases,
    });
  }

  static createMock(props) {
    return new Case({
      caseRef: "case-ref",
      workflowCode: "workflow-code",
      position: new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "STATUS_1",
      }),
      dateReceived: "2025-01-01T00:00:00.000Z",
      payload: {},
      supplementaryData: {},
      phases: [
        new CasePhase({
          code: "PHASE_1",
          stages: [
            new CaseStage({
              code: "STAGE_1",
              taskGroups: [
                new CaseTaskGroup({
                  code: "TASK_GROUP_1",
                  tasks: [
                    new CaseTask({
                      code: "TASK_1",
                      status: "PENDING",
                      completed: false,
                      // this should be refactored to use null
                      commentRef: undefined,
                      updatedAt: undefined,
                      updatedBy: undefined,
                    }),
                  ],
                }),
              ],
            }),
            new CaseStage({
              code: "STAGE_2",
              taskGroups: [],
            }),
          ],
        }),
      ],
      timeline: [
        new TimelineEvent({
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
      },
      ...props,
    });
  }
}
