import Boom from "@hapi/boom";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { Comment } from "../models/comment.js";
import { EventEnums } from "../models/event-enums.js";
import { Permissions } from "../models/permissions.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { updateAssignedUser } from "../repositories/case.repository.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

const createTimelineEvent = (userId, kase, type, commentRef = null) => {
  return new TimelineEvent({
    eventType: type,
    createdBy: "System", // TODO: user details need to come from authorised user
    commentRef,
    data: {
      assignedTo: userId,
      previouslyAssignedTo: kase.assignedUser?.id,
    },
  });
};

const createComment = (text) => {
  if (text) {
    return new Comment(
      EventEnums.eventTypes.CASE_ASSIGNED, // TODO extract eventTypes
      text,
    );
  } else {
    return null;
  }
};

const unassignUser = async (command) => {
  const { caseId, notes } = command;
  const kase = await findCaseByIdUseCase(caseId);
  const comment = createComment(notes);

  await updateAssignedUser(
    caseId,
    null,
    createTimelineEvent(
      null,
      kase,
      EventEnums.eventTypes.CASE_UNASSIGNED,
      comment?.ref,
    ),
    comment,
  );
};

export const assignUserToCaseUseCase = async (command) => {
  const { assignedUserId, caseId, notes } = command;

  const kase = await findCaseByIdUseCase(caseId);

  if (assignedUserId === null) {
    unassignUser(command);
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
  const comment = createComment(notes);

  const timelineEvent = createTimelineEvent(
    user.id,
    kase,
    EventEnums.eventTypes.CASE_ASSIGNED,
    comment?.ref,
  );

  await updateAssignedUser(caseId, user.id, timelineEvent, comment);
};
