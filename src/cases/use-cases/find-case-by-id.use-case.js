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

// we format the description on fetching data incase the stage/task changes.
export const formatTimelineItemDescription = (tl, workflow) => {
  switch (tl.eventType) {
    case EventEnums.eventTypes.TASK_COMPLETED: {
      const { stageCode, taskGroupCode, taskCode } = tl.data;
      return `Task '${workflow.findTask(stageCode, taskGroupCode, taskCode).name}' completed`;
    }
    case EventEnums.eventTypes.STAGE_COMPLETED: {
      const stage = workflow.findStage(tl.data.stageCode);
      return `Stage '${stage.name}' outcome (${tl.data.actionId})`;
    }
    default:
      return tl.description || EventEnums.eventDescriptions[tl.eventType];
  }
};

const mapTasks = (tasks, workflowTaskGroup, userMap) =>
  tasks.map((task) => {
    const workflowTaskGroupTask = workflowTaskGroup.tasks.find(
      (wtgt) => wtgt.code === task.code,
    );
    return {
      ...task,
      name: workflowTaskGroupTask.name,
      description: workflowTaskGroupTask.description,
      updatedBy: mapUserIdToName(task.updatedBy, userMap),
    };
  });

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

  kase.stages = kase.stages.map((stage) => {
    const workflowStage = workflow.findStage(stage.code);
    return {
      ...stage,
      name: workflowStage.name,
      description: workflowStage.description,
      taskGroups: stage.taskGroups.map((taskGroup) => {
        const workflowTaskGroup = workflowStage.taskGroups.find(
          (tg) => tg.code === taskGroup.code,
        );
        return {
          ...taskGroup,
          name: workflowTaskGroup.name,
          description: workflowTaskGroup.description,
          tasks: mapTasks(taskGroup.tasks, workflowTaskGroup, userMap),
        };
      }),
      outcome: stage.outcome
        ? {
            ...stage.outcome,
            comment: kase.findComment(stage.outcome?.commentRef)?.text,
          }
        : undefined,
    };
  });

  kase.timeline = kase.timeline.map((tl) => {
    tl.createdBy = mapUserIdToUser(tl.createdBy, userMap);
    if (tl.data?.assignedTo) {
      tl.data.assignedTo = mapUserIdToUser(tl.data.assignedTo, userMap);
    }
    tl.commentRef = mapComment(tl.comment);
    tl.comment = undefined;
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

const mapComment = (comment) => {
  return comment?.ref || undefined;
};
