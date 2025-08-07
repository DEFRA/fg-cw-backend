import Boom from "@hapi/boom";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { Permissions } from "../models/permissions.js";
import { findById, update } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

export const assignUserToCaseUseCase = async (command) => {
  const { assignedUserId, caseId, notes } = command;

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  if (assignedUserId === null) {
    kase.assignUser(null, notes);
    return update(kase);
  }

  const [user, workflow] = await Promise.all([
    findUserByIdUseCase(assignedUserId),
    findWorkflowByCodeUseCase(kase.workflowCode),
  ]);

  // Check if the user we want to assign has permissions for the case...
  // TODO: This permission check should live inside Case once Case and Workflow are merged
  const permissions = new Permissions(workflow.requiredRoles);

  if (!permissions.isAuthorised(user.appRoles)) {
    throw Boom.unauthorized(
      `User with id "${user.id}" does not have the required permissions to be assigned to this case.`,
    );
  }

  kase.assignUser(assignedUserId, notes);
  return update(kase);
};
