import Boom from "@hapi/boom";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { findById } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

const CASE_ASSIGNED = "CASE_ASSIGNED";

export const findCaseByIdUseCase = async (caseId) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  if (kase.assignedUser) {
    const user = await findUserByIdUseCase(kase.assignedUser.id);

    kase.assignedUser.name = user.name;
  }

  // find timeline user data
  const createdByUserIds = kase.timeline
    .map((t) => t.createdBy)
    .filter((user) => user !== "System");

  const createdByUsers = await findUsersUseCase({
    ids: createdByUserIds,
  });

  const assignedToUserIds = kase.timeline
    .filter((t) => !!t.data?.assignedTo)
    .map((t) => t.data.assignedTo);

  const assignedToUsers = await findUsersUseCase({
    ids: assignedToUserIds,
  });

  const timeline = kase.timeline.map((tl) => {
    populateTimelineCreatedByUser(tl, createdByUsers);

    if (tl.eventType === CASE_ASSIGNED && tl.data.assignedTo) {
      const usr = assignedToUsers.find((atu) => atu.id === tl.data.assignedTo);

      tl.data.assignedTo = {
        email: usr.email,
        name: usr.name,
        id: usr.id,
      };
    }

    return tl;
  });

  kase.timeline = timeline;
  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);
  kase.requiredRoles = workflow.requiredRoles;

  return kase;
};

const populateTimelineCreatedByUser = (timelineItem, users) => {
  const createdByUser = users?.find((u) => u.id === timelineItem.createdBy);
  if (createdByUser) {
    timelineItem.createdBy = createdByUser;
  } else {
    timelineItem.createdBy = { name: "System" };
  }
};

export const findUserAssignedToCase = (caseId) => {
  return "System"; // TODO: get user who has completed the task
};
