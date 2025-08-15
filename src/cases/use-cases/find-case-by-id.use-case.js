import Boom from "@hapi/boom";
import { getAuthenticatedUser } from "../../common/auth.js";
import { findAll } from "../../users/repositories/user.repository.js";
import { findById } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

export const findCaseByIdUseCase = async (caseId) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const userMap = await createUserMap(kase.getUserIds());

  kase.assignedUser = userMap.get(kase.assignedUser?.id) || null;
  kase.timeline = kase.timeline.map((tl) => {
    tl.createdBy = userMap.get(tl.createdBy);
    if (tl.data?.assignedTo) {
      tl.data.assignedTo = userMap.get(tl.data.assignedTo);
    }
    tl.commentRef = mapComment(tl.comment);
    return tl;
  });

  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);
  kase.requiredRoles = workflow.requiredRoles;

  kase.comments = kase.comments.map((comment) => ({
    ...comment,
    title: comment.title,
    createdBy: userMap.get(comment.createdBy).name,
  }));

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
  return comment?.ref || null;
};
