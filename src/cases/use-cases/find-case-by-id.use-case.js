import Boom from "@hapi/boom";
import { getAuthenticatedUser } from "../../common/auth.js";
import { buildBanner, buildLinks } from "../../common/json.js";
import { findAll } from "../../users/repositories/user.repository.js";
import { EventEnums } from "../models/event-enums.js";
import { findById } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

// we format the description on fetching data incase the stage/task changes.
export const formatTimelineItemDescription = (tl, workflow) => {
  switch (tl.eventType) {
    case EventEnums.eventTypes.TASK_COMPLETED: {
      const { stageId, taskGroupId, taskId } = tl.data;
      return `Task '${workflow.findTask(stageId, taskGroupId, taskId).title}' completed`;
    }
    case EventEnums.eventTypes.STAGE_COMPLETED: {
      const stage = workflow.findStage(tl.data.stageId);
      return `Stage '${stage.title}' outcome (${tl.data.actionId})`;
    }
    default:
      return tl.description || EventEnums.eventDescriptions[tl.eventType];
  }
};

export const findCaseByIdUseCase = async (caseId) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const userMap = await createUserMap(kase.getUserIds());

  kase.assignedUser = userMap.get(kase.assignedUser?.id) || null;

  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);
  kase.tabs = workflow.pages.cases.details.tabs;
  kase.banner = buildBanner(kase, workflow);
  kase.definitions = workflow.definitions;
  kase.requiredRoles = workflow.requiredRoles;

  kase.links = buildLinks(kase, workflow);

  kase.comments = kase.comments.map((comment) => ({
    ...comment,
    title: comment.title,
    createdBy: userMap.get(comment.createdBy).name,
  }));

  kase.stages = kase.stages.map((stage) => {
    return {
      ...stage,
      taskGroups: stage.taskGroups.map((taskGroup) => ({
        ...taskGroup,
        tasks: taskGroup.tasks.map((task) => {
          return {
            ...task,
            updatedBy: task.updatedBy ? userMap.get(task.updatedBy).name : null,
          };
        }),
      })),
      outcome: stage.outcome
        ? {
            ...stage.outcome,
            comment: kase.findComment(stage.outcome?.commentRef)?.text,
          }
        : undefined,
    };
  });

  kase.timeline = kase.timeline.map((tl) => {
    tl.createdBy = userMap.get(tl.createdBy);
    if (tl.data?.assignedTo) {
      tl.data.assignedTo = userMap.get(tl.data.assignedTo);
    }
    tl.commentRef = mapComment(tl.comment);
    tl.comment = undefined;
    tl.description = formatTimelineItemDescription(tl, workflow);
    return tl;
  });

  return kase;
};

const createUserMap = async (userIds) => {
  const ids = userIds.filter((id) => id !== "System" && id !== null);
  const users = await findAll({ ids });
  const userMap = new Map(users.map((user) => [user.id, user]));

  const authenticatedUser = getAuthenticatedUser();
  userMap.set(authenticatedUser.id, authenticatedUser);

  return userMap;
};

export const findUserAssignedToCase = () => {
  return "System"; // TODO: get user who has completed the task from auth
};

const mapComment = (comment) => {
  return comment?.ref || undefined;
};
