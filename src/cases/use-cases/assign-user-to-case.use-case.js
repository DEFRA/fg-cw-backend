import Boom from "@hapi/boom";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { Permissions } from "../models/permissions.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { updateAssignedUser } from "../repositories/case.repository.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

export const assignUserToCaseUseCase = async (command) => {
  if (command.assignedUserId === null) {
    await updateAssignedUser(command.caseId, null);
    return;
  }

  const kase = await findCaseByIdUseCase(command.caseId);

  const [user, workflow] = await Promise.all([
    findUserByIdUseCase(command.assignedUserId),
    findWorkflowByCodeUseCase(kase.workflowCode),
  ]);

  // TODO: This permission check should live inside Case once Case and Workflow are merged
  const permissions = new Permissions(workflow.requiredRoles);

  if (!permissions.isAuthorised(user.appRoles)) {
    throw Boom.unauthorized(
      `User with id "${user.id}" does not have the required permissions to be assigned to this case.`,
    );
  }

  const timelineEvent = new TimelineEvent({
    eventType: TimelineEvent.eventTypes.CASE_ASSIGNED,
    createdBy: "System", // TODO: user details need to come from authorised user
    data: {
      assignedTo: user.id,
      previouslyAssignedTo: kase.assignedUser?.id,
    },
  });

  await updateAssignedUser(command.caseId, user.id, timelineEvent);
};
