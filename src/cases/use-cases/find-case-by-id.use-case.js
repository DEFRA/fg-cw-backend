import Boom from "@hapi/boom";
import { AccessControl } from "../../common/access-control.js";
import {
  buildBanner,
  buildLinks,
  createCaseWorkflowContext,
} from "../../common/build-view-model.js";
import { logger } from "../../common/logger.js";
import { resolveJSONPath } from "../../common/resolve-json.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
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

const findCommentByRef = (comments, ref) => comments.find((c) => c.ref === ref);

const findStatusOptionByCode = (statusOptions, code) =>
  statusOptions.find((opt) => opt.code === code);

const getCommentDate = (comment) => comment?.createdAt ?? null;
const getCommentText = (comment) => comment?.text ?? null;
const getCommentCreatedBy = (comment) => comment?.createdBy;
const getOutcomeName = (statusOption, fallback) =>
  statusOption?.name ?? fallback;

const mapCommentRefToNoteHistory = (
  commentRef,
  comment,
  statusOption,
  userMap,
) => ({
  date: getCommentDate(comment),
  outcome: getOutcomeName(statusOption, commentRef.status),
  note: getCommentText(comment),
  addedBy: mapUserIdToName(getCommentCreatedBy(comment), userMap),
});

const mapNotesHistory = (commentRefs, comments, statusOptions, userMap) => {
  if (!commentRefs?.length) {
    return [];
  }

  return commentRefs
    .map((commentRef) => {
      const comment = findCommentByRef(comments, commentRef.ref);
      const statusOption = findStatusOptionByCode(
        statusOptions,
        commentRef.status,
      );
      return mapCommentRefToNoteHistory(
        commentRef,
        comment,
        statusOption,
        userMap,
      );
    })
    .filter((entry) => entry.date !== null);
};

const mapTasks = async (
  caseTaskGroup,
  workflowTaskGroup,
  userMap,
  root,
  comments,
) =>
  Promise.all(
    caseTaskGroup.tasks.map(async (caseTaskGroupTask) => {
      const workflowTaskGroupTask = workflowTaskGroup.findTask(
        caseTaskGroupTask.code,
      );

      const selectedStatus = mapSelectedStatusOption(
        caseTaskGroupTask.status,
        workflowTaskGroupTask.statusOptions,
      );

      const notesHistory = mapNotesHistory(
        caseTaskGroupTask.commentRefs,
        comments,
        workflowTaskGroupTask.statusOptions,
        userMap,
      );

      return {
        code: caseTaskGroupTask.code,
        name: workflowTaskGroupTask.name,
        description: await mapDescription(workflowTaskGroupTask, root),
        mandatory: workflowTaskGroupTask.mandatory,
        statusOptions: mapStatusOptions(workflowTaskGroupTask.statusOptions),
        status: caseTaskGroupTask.status,
        statusText: selectedStatus.statusText,
        statusTheme: selectedStatus.statusTheme,
        completed: caseTaskGroupTask.completed,
        commentInputDef: mapWorkflowCommentDef(workflowTaskGroupTask),
        commentRefs: caseTaskGroupTask.commentRefs,
        notesHistory,
        updatedAt: caseTaskGroupTask.updatedAt,
        updatedBy: mapUserIdToName(caseTaskGroupTask.updatedBy, userMap),
        requiredRoles: workflowTaskGroupTask.requiredRoles,
        canComplete: AccessControl.canAccess(root.user, {
          idpRoles: [],
          appRoles: workflowTaskGroupTask.requiredRoles,
        }),
      };
    }),
  );

export const mapStatusOptions = (statusOptions) =>
  statusOptions.map((option) => ({
    code: option.code,
    name: option.altName || option.name,
    theme: option.theme,
    completes: option.completes,
  }));

export const mapSelectedStatusOption = (statusCode, statusOptions) => {
  if (!statusCode) {
    return {
      statusText: "Incomplete",
      statusTheme: "INFO",
    };
  }

  const selectedOption = statusOptions.find((opt) => opt.code === statusCode);

  if (!selectedOption) {
    return {
      statusText: "Incomplete",
      statusTheme: "INFO",
    };
  }

  return {
    statusText: selectedOption.name,
    statusTheme: selectedOption.theme ?? "NONE",
  };
};

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
    mandatory: true,
  };

  return workflowTask?.comment
    ? { ...DEFAULT_COMMENT, ...workflowTask.comment }
    : DEFAULT_COMMENT;
};

export const findCaseByIdUseCase = async (caseId, user, request) => {
  logger.info(`Finding case by id "${caseId}"`);

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);
  const caseWorkflowContext = createCaseWorkflowContext({
    kase,
    workflow,
    request,
    user,
  });

  const userMap = await createUserMap(kase.getUserIds(), user);
  const workflowStage = workflow.getStage(kase.position);
  const currentStatus = workflow.getStatus(kase.position);
  const caseStage = kase.getStage();
  const assignedUser = userMap.get(kase.assignedUser?.id);

  logger.info(`Finished: Finding case by id "${caseId}"`);

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
    createdAt: kase.createdAt,
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

  userMap.set(user.id, user);

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
  comments,
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
          comments,
        ),
      };
    }),
  );
};

const canPerformStageActions = (user, workflow) => {
  return AccessControl.canAccess(user, {
    idpRoles: [IdpRoles.ReadWrite],
    appRoles: workflow.requiredRoles,
  });
};

const mapStageActions = (kase, workflow, canPerformActions) => {
  if (!canPerformActions) {
    return [];
  }
  return kase.getPermittedActions(workflow).map((a) => ({
    code: a.code,
    name: a.name,
    comment: a.comment,
  }));
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
  const canPerformActions = canPerformStageActions(
    caseWorkflowContext.user,
    workflow,
  );

  return {
    code: workflowStage.code,
    name: workflowStage.name,
    description: workflowStage.description,
    interactive: currentStatus.interactive,
    canPerformActions,
    taskGroups: await mapTaskGroups(
      caseStage,
      workflowStage,
      userMap,
      caseWorkflowContext,
      kase.comments,
    ),
    actions: mapStageActions(kase, workflow, canPerformActions),
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
