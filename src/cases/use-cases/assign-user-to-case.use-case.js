import Boom from "@hapi/boom";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { Permissions } from "../models/permissions.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { updateAssignedUser } from "../repositories/case.repository.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

const createTimelineEvent = (userId, kase, type) => {
  return new TimelineEvent({
    eventType: type,
    createdBy: "System", // TODO: user details need to come from authorised user
    data: {
      assignedTo: userId,
      previouslyAssignedTo: kase.assignedUser?.id,
    },
  });
};

export const assignUserToCaseUseCase = async (command) => {
  const { assignedUserId, caseId } = command;

  const kase = await findCaseByIdUseCase(caseId);

  if (assignedUserId === null) {
    await updateAssignedUser(
      caseId,
      null,
      createTimelineEvent(
        assignedUserId,
        kase,
        TimelineEvent.eventTypes.CASE_UNASSIGNED,
      ),
    );
    return;
  }

  const [user, workflow] = await Promise.all([
    findUserByIdUseCase(assignedUserId),
    findWorkflowByCodeUseCase(kase.workflowCode),
  ]);

  // TODO: This permission check should live inside Case once Case and Workflow are merged
  const permissions = new Permissions(workflow.requiredRoles);

  if (!permissions.isAuthorised(user.appRoles)) {
    throw Boom.unauthorized(
      `User with id "${user.id}" does not have the required permissions to be assigned to this case.`,
    );
  }

  const timelineEvent = createTimelineEvent(
    user.id,
    kase,
    TimelineEvent.eventTypes.CASE_ASSIGNED,
  );

  await updateAssignedUser(caseId, user.id, timelineEvent);
};
