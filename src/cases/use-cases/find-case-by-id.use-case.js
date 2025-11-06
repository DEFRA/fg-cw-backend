import Boom from "@hapi/boom";
import { getAuthenticatedUser } from "../../common/auth.js";
import { buildBanner, buildLinks } from "../../common/build-view-model.js";
import { findAll } from "../../users/repositories/user.repository.js";
import { EventEnums } from "../models/event-enums.js";
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
      const phase = workflow.findPhase(tl.data.phaseCode);
      const stage = phase.findStage(tl.data.stageCode);
      return `Stage '${stage.name}' outcome (${tl.data.actionCode})`;
    }
    default:
      return tl.description || EventEnums.eventDescriptions[tl.eventType];
  }
};

const mapTasks = (caseTaskGroup, workflowTaskGroup, userMap) =>
  caseTaskGroup.tasks.map((caseTaskGroupTask) => {
    const workflowTaskGroupTask = workflowTaskGroup.tasks.find(
      (wtgt) => wtgt.code === caseTaskGroupTask.code,
    );

    return {
      code: caseTaskGroupTask.code,
      name: workflowTaskGroupTask.name,
      description: mapDescription(workflowTaskGroupTask),
      type: workflowTaskGroupTask.type,
      statusOptions: workflowTaskGroupTask.statusOptions,
      status: caseTaskGroupTask.status,
      completed: caseTaskGroupTask.completed,
      commentInputDef: mapWorkflowComment(workflowTaskGroupTask),
      commentRef: caseTaskGroupTask.commentRef,
      updatedAt: caseTaskGroupTask.updatedAt,
      updatedBy: mapUserIdToName(caseTaskGroupTask.updatedBy, userMap),
      requiredRoles: workflowTaskGroupTask.requiredRoles,
    };
  });

const mapTaskGroups = (caseStage, workflowStage, userMap) =>
  caseStage.taskGroups.map((caseTaskGroup) => {
    const workflowTaskGroup = workflowStage.taskGroups.find(
      (wtg) => wtg.code === caseTaskGroup.code,
    );

    return {
      code: caseTaskGroup.code,
      name: workflowTaskGroup.name,
      description: workflowTaskGroup.description,
      tasks: mapTasks(caseTaskGroup, workflowTaskGroup, userMap),
    };
  });

const mapStages = (casePhase, workflowPhase, kase, userMap) =>
  casePhase.stages.map((caseStage) => {
    const workflowStage = workflowPhase.findStage(caseStage.code);

    return {
      code: caseStage.code,
      name: workflowStage.name,
      description: workflowStage.description,
      taskGroups: mapTaskGroups(caseStage, workflowStage, userMap),
      statuses: workflowStage.statuses,
      actions: workflowStage.actions,
      outcome: caseStage.outcome
        ? {
            ...caseStage.outcome,
            comment: kase.findComment(caseStage.outcome?.commentRef)?.text,
          }
        : undefined,
    };
  });

const mapPhases = (kase, workflow, userMap) =>
  kase.phases.map((casePhase) => {
    const workflowPhase = workflow.findPhase(casePhase.code);

    return {
      code: casePhase.code,
      name: workflowPhase.name,
      stages: mapStages(casePhase, workflowPhase, kase, userMap),
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

export const mapWorkflowComment = (workflowTask) => {
  const DEFAULT_COMMENT = {
    label: "Note",
    helpText: "All notes will be saved for auditing purposes",
    mandatory: false,
  };

  return workflowTask?.comment
    ? { ...DEFAULT_COMMENT, ...workflowTask.comment }
    : DEFAULT_COMMENT;
};

export const findCaseByIdUseCase = async (caseId, user) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const userMap = await createUserMap(kase.getUserIds(), user);

  kase.assignedUser = userMap.get(kase.assignedUser?.id) || null;

  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);

  kase.banner = buildBanner(kase, workflow);
  kase.requiredRoles = workflow.requiredRoles;
  kase.links = buildLinks(kase, workflow);

  kase.comments = kase.comments.map((comment) => ({
    ...comment,
    title: comment.title,
    createdBy: mapUserIdToName(comment.createdBy, userMap),
  }));

  kase.phases = mapPhases(kase, workflow, userMap);

  kase.timeline = kase.timeline.map((tl) => {
    tl.createdBy = mapUserIdToUser(tl.createdBy, userMap);
    if (tl.data?.assignedTo) {
      tl.data.assignedTo = mapUserIdToUser(tl.data.assignedTo, userMap);
    }
    tl.commentRef = mapCommentRef(tl.comment);
    tl.comment = null;
    tl.description = formatTimelineItemDescription(tl, workflow);
    return tl;
  });

  return kase;
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
