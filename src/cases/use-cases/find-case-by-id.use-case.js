import Boom from "@hapi/boom";
import { getAuthenticatedUser } from "../../common/auth.js";
import { findAll } from "../../users/repositories/user.repository.js";
import { EventEnums } from "../models/event-enums.js";
import { Workflow } from "../models/workflow.js";
import { findById } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

const findWorkflowTask = (workflow, stageId, taskGroupId, taskId) => {
  const wf = new Workflow(workflow);
  const task = wf.findTask(stageId, taskGroupId, taskId);
  return task;
};

// we format the description on fetching data incase the stage/task changes.
const formatTimelineItemDescription = (tl, tasks, stages) => {
  switch (tl.eventType) {
    case EventEnums.eventTypes.TASK_COMPLETED:
      return `Task '${tasks.get(tl.data.taskId).title}' completed`;
    case EventEnums.eventTypes.STAGE_COMPLETED:
      return `Stage '${stages.get(tl.data.stageId).title}' outcome (${tl.data.actionId})`;
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
  kase.requiredRoles = workflow.requiredRoles;

  kase.comments = kase.comments.map((comment) => ({
    ...comment,
    title: comment.title,
    createdBy: userMap.get(comment.createdBy).name,
  }));

  const tasks = new Map();
  const stages = new Map();

  kase.stages = kase.stages.map((stage) => {
    stages.set(
      stage.id,
      workflow.stages.find((s) => s.id === stage.id),
    );
    return {
      ...stage,
      taskGroups: stage.taskGroups.map((taskGroup) => ({
        ...taskGroup,
        tasks: taskGroup.tasks.map((task) => {
          tasks.set(
            task.id,
            findWorkflowTask(workflow, stage.id, taskGroup.id, task.id),
          );
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
    tl.description = formatTimelineItemDescription(tl, tasks, stages);
    return tl;
  });

  return kase;
};

const createUserMap = async (userIds) => {
  const ids = userIds.filter((id) => id !== "System");
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
