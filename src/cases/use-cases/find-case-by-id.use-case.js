import Boom from "@hapi/boom";
import { getAuthenticatedUser } from "../../common/auth.js";
import {
  buildBanner,
  buildLinks,
  createCaseWorkflowContext,
} from "../../common/build-view-model.js";
import { logger } from "../../common/logger.js";
import { resolveJSONPath } from "../../common/resolve-json.js";
import { findAll } from "../../users/repositories/user.repository.js";
import { EventEnums } from "../models/event-enums.js";
import { Position } from "../models/position.js";
import { findById } from "../repositories/case.repository.js";
import { buildBeforeContent } from "./build-before-content.js";
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

const mapTasks = async (caseTaskGroup, workflowTaskGroup, userMap, root) =>
  Promise.all(
    caseTaskGroup.tasks.map(async (caseTaskGroupTask) => {
      const workflowTaskGroupTask = workflowTaskGroup.findTask(
        caseTaskGroupTask.code,
      );

      return {
        code: caseTaskGroupTask.code,
        name: workflowTaskGroupTask.name,
        description: await mapDescription(workflowTaskGroupTask, root),
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
    }),
  );

const isValidArray = (description) =>
  Array.isArray(description) && description.length > 0;

const isValidString = (description) =>
  typeof description === "string" && description.trim() !== "";

export const mapDescription = async ({ name = "Task", description }, root) => {
  if (isValidArray(description)) {
    const resolved = await resolveJSONPath({ root, path: description });
    return resolved;
  }

  if (isValidString(description)) {
    return [{ component: "heading", level: 2, text: description }];
  }

  return [{ component: "heading", level: 2, text: name }];
};

export const mapWorkflowCommentDef = (workflowTask) => {
  const DEFAULT_COMMENT = {
    label: "Explain this outcome",
    helpText: "You must include an explanation for auditing purposes.",
    mandatory: false,
  };

  return workflowTask?.comment
    ? { ...DEFAULT_COMMENT, ...workflowTask.comment }
    : DEFAULT_COMMENT;
};

export const findCaseByIdUseCase = async (caseId, user, request) => {
  const kase = await findById(caseId);

  logger.info(`Finding case by id ${caseId}`);
  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }
  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);
  const caseWorkflowContext = createCaseWorkflowContext(
    kase,
    workflow,
    request,
  );

  const userMap = await createUserMap(kase.getUserIds(), user);
  const workflowStage = workflow.getStage(kase.position);
  const currentStatus = workflow.getStatus(kase.position);
  const caseStage = kase.getStage();
  const assignedUser = userMap.get(kase.assignedUser?.id);

  logger.info(`Finished:Finding case by id ${caseId}`);

  return {
    _id: kase._id,
    caseRef: kase.caseRef,
    workflowCode: kase.workflowCode,
    currentStatus: kase.position.statusCode,
    stage: await mapStageData(
      kase,
      workflow,
      workflowStage,
      currentStatus,
      caseStage,
      userMap,
      caseWorkflowContext,
    ),
    dateReceived: kase.dateReceived,
    payload: kase.payload,
    supplementaryData: kase.supplementaryData,
    assignedUser: assignedUser ? { name: assignedUser.name } : null,
    banner: await buildBanner(caseWorkflowContext),
    requiredRoles: {
      allOf: workflow.requiredRoles.allOf,
      anyOf: workflow.requiredRoles.anyOf,
    },
    links: await buildLinks(caseWorkflowContext),
    comments: mapCommentsWithUsers(kase.comments, userMap),
    timeline: mapTimelineWithUsers(kase.timeline, workflow, userMap),
    beforeContent: await buildBeforeContent(workflowStage, caseWorkflowContext),
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

const mapTaskGroups = async (
  caseStage,
  workflowStage,
  userMap,
  caseWorkflowContext,
) => {
  return await Promise.all(
    caseStage.taskGroups.map(async (caseTaskGroup) => {
      const workflowTaskGroup = workflowStage.findTaskGroup(caseTaskGroup.code);
      return {
        code: caseTaskGroup.code,
        name: workflowTaskGroup.name,
        description: workflowTaskGroup.description,
        tasks: await mapTasks(
          caseTaskGroup,
          workflowTaskGroup,
          userMap,
          caseWorkflowContext,
        ),
      };
    }),
  );
};

const mapStageData = async (
  kase,
  workflow,
  workflowStage,
  currentStatus,
  caseStage,
  userMap,
  caseWorkflowContext,
) => {
  return {
    code: workflowStage.code,
    name: workflowStage.name,
    description: workflowStage.description,
    interactive: currentStatus.interactive,
    taskGroups: await mapTaskGroups(
      caseStage,
      workflowStage,
      userMap,
      caseWorkflowContext,
    ),
    actions: kase.getPermittedActions(workflow).map((a) => ({
      code: a.code,
      name: a.name,
      comment: a.comment,
    })),
    outcome: caseStage.outcome && {
      ...caseStage.outcome,
      comment: kase.findComment(caseStage.outcome?.commentRef)?.text,
    },
  };
};

const mapCommentsWithUsers = (comments, userMap) => {
  return comments.map((comment) => ({
    ...comment,
    title: comment.title,
    createdBy: mapUserIdToName(comment.createdBy, userMap),
  }));
};

const mapTimelineWithUsers = (timeline, workflow, userMap) => {
  return timeline.map((tl) => {
    tl.createdBy = mapUserIdToUser(tl.createdBy, userMap);
    if (tl.data?.assignedTo) {
      tl.data.assignedTo = mapUserIdToUser(tl.data.assignedTo, userMap);
    }
    tl.commentRef = mapCommentRef(tl.comment);
    tl.comment = null;
    tl.description = formatTimelineItemDescription(tl, workflow);
    return tl;
  });
};
