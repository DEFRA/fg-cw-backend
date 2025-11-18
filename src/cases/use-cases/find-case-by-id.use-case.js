import Boom from "@hapi/boom";
import { getAuthenticatedUser } from "../../common/auth.js";
import { buildBanner, buildLinks } from "../../common/build-view-model.js";
import { findAll } from "../../users/repositories/user.repository.js";
import { EventEnums } from "../models/event-enums.js";
import { Position } from "../models/position.js";
import { findById } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

// eslint-disable-next-line complexity
const mapUserIdToName = (userId, userMap) => {
  if (userId === "System") {
    return "System";
  }
  if (!userId) {
    return null;
  }
  return userMap.get(userId)?.name ?? null;
};

const mapUserIdToUser = (userId, userMap) => {
  if (userId === "System") {
    return {
      id: "System",
      name: "System",
    };
  }
  return userMap.get(userId);
};

// eslint-disable-next-line complexity
export const formatTimelineItemDescription = (tl, workflow) => {
  switch (tl.eventType) {
    case EventEnums.eventTypes.TASK_COMPLETED: {
      const { phaseCode, stageCode, taskGroupCode, taskCode } = tl.data;
      return `Task '${workflow.findTask({ phaseCode, stageCode, taskGroupCode, taskCode }).name}' completed`;
    }
    case EventEnums.eventTypes.TASK_UPDATED: {
      const { phaseCode, stageCode, taskGroupCode, taskCode } = tl.data;
      return `Task '${workflow.findTask({ phaseCode, stageCode, taskGroupCode, taskCode }).name}' updated`;
    }
    case EventEnums.eventTypes.STAGE_COMPLETED: {
      const position = new Position({
        phaseCode: tl.data.phaseCode,
        stageCode: tl.data.stageCode,
        statusCode: tl.data.statusCode,
      });
      const stage = workflow.getStage(position);
      const action = stage.getActionByCode(position, tl.data.actionCode);
      const info = action ? `outcome (${action.name})` : "completed";
      return `Stage '${stage.name}' ${info}`;
    }
    case EventEnums.eventTypes.PHASE_COMPLETED: {
      const phase = workflow.findPhase(tl.data.phaseCode);
      return `Phase '${phase.name}' completed`;
    }
    case EventEnums.eventTypes.CASE_STATUS_CHANGED: {
      const phase = workflow.findPhase(tl.data.phaseCode);
      const stage = phase.findStage(tl.data.stageCode);
      const status = stage.getStatus(tl.data.statusCode);
      return `Status changed to '${status.name}'`;
    }
    default:
      return tl.description || EventEnums.eventDescriptions[tl.eventType];
  }
};

const mapTasks = (caseTaskGroup, workflowTaskGroup, userMap) =>
  caseTaskGroup.tasks.map((caseTaskGroupTask) => {
    const workflowTaskGroupTask = workflowTaskGroup.findTask(
      caseTaskGroupTask.code,
    );

    return {
      code: caseTaskGroupTask.code,
      name: workflowTaskGroupTask.name,
      description: mapDescription(workflowTaskGroupTask),
      mandatory: workflowTaskGroupTask.mandatory,
      statusOptions: workflowTaskGroupTask.statusOptions,
      status: caseTaskGroupTask.status,
      completed: caseTaskGroupTask.completed,
      commentInputDef: mapWorkflowCommentDef(workflowTaskGroupTask),
      commentRef: caseTaskGroupTask.commentRef,
      updatedAt: caseTaskGroupTask.updatedAt,
      updatedBy: mapUserIdToName(caseTaskGroupTask.updatedBy, userMap),
      requiredRoles: workflowTaskGroupTask.requiredRoles && {
        allOf: workflowTaskGroupTask.requiredRoles.allOf,
        anyOf: workflowTaskGroupTask.requiredRoles.anyOf,
      },
    };
  });

const isValidArray = (description) =>
  Array.isArray(description) && description.length > 0;

const isValidString = (description) =>
  typeof description === "string" && description.trim() !== "";

export const mapDescription = ({ name = "Task", description }) => {
  if (isValidArray(description)) {
    return description;
  }

  if (isValidString(description)) {
    return [{ component: "heading", level: 2, text: description }];
  }

  return [{ component: "heading", level: 2, text: name }];
};

export const mapWorkflowCommentDef = (workflowTask) => {
  const DEFAULT_COMMENT = {
    label: "Note",
    helpText: "All notes will be saved for auditing purposes",
    mandatory: false,
  };

  return workflowTask?.comment
    ? { ...DEFAULT_COMMENT, ...workflowTask.comment }
    : DEFAULT_COMMENT;
};

// eslint-disable-next-line complexity
export const findCaseByIdUseCase = async (caseId, user) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);

  const userMap = await createUserMap(kase.getUserIds(), user);

  const workflowStage = workflow.getStage(kase.position);
  const currentStatus = workflow.getStatus(kase.position);
  const caseStage = kase.getStage();

  const assignedUser = userMap.get(kase.assignedUser?.id);

  return {
    _id: kase._id,
    caseRef: kase.caseRef,
    workflowCode: kase.workflowCode,
    currentStatus: kase.position.statusCode,
    stage: {
      code: workflowStage.code,
      name: workflowStage.name,
      description: workflowStage.description,
      interactive: currentStatus.interactive,
      taskGroups: caseStage.taskGroups.map((caseTaskGroup) => {
        const workflowTaskGroup = workflowStage.findTaskGroup(
          caseTaskGroup.code,
        );

        return {
          code: caseTaskGroup.code,
          name: workflowTaskGroup.name,
          description: workflowTaskGroup.description,
          tasks: mapTasks(caseTaskGroup, workflowTaskGroup, userMap),
        };
      }),
      actionsDisabled: !kase.isStageComplete(workflow),
      actions: workflowStage.getActions(kase.position).map((a) => ({
        code: a.code,
        name: a.name,
        comment: a.comment,
      })),
      outcome: caseStage.outcome && {
        ...caseStage.outcome,
        comment: kase.findComment(caseStage.outcome?.commentRef)?.text,
      },
    },
    dateReceived: kase.dateReceived,
    payload: kase.payload,
    supplementaryData: kase.supplementaryData,
    assignedUser: assignedUser
      ? {
          name: assignedUser.name,
        }
      : null,
    banner: buildBanner(kase, workflow),
    requiredRoles: {
      allOf: workflow.requiredRoles.allOf,
      anyOf: workflow.requiredRoles.anyOf,
    },
    links: buildLinks(kase, workflow),
    comments: kase.comments.map((comment) => ({
      ...comment,
      title: comment.title,
      createdBy: mapUserIdToName(comment.createdBy, userMap),
    })),
    timeline: kase.timeline.map((tl) => {
      tl.createdBy = mapUserIdToUser(tl.createdBy, userMap);
      if (tl.data?.assignedTo) {
        tl.data.assignedTo = mapUserIdToUser(tl.data.assignedTo, userMap);
      }
      tl.commentRef = mapCommentRef(tl.comment);
      tl.comment = null;
      tl.description = formatTimelineItemDescription(tl, workflow);
      return tl;
    }),
  };
};

const createUserMap = async (userIds, user) => {
  const ids = userIds.filter((id) => id !== "System" && id !== null);
  const users = await findAll({ ids });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const authenticatedUser = getAuthenticatedUser(user);
  userMap.set(authenticatedUser.id, authenticatedUser);

  return userMap;
};

const mapCommentRef = (comment) => {
  return comment?.ref || undefined;
};
