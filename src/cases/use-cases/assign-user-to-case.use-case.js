import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { findById, update } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

export const assignUserToCaseUseCase = async (command) => {
  const { assignedUserId, caseId, notes, user } = command;

  logger.info(`Assigning user to case use case started - caseId: ${caseId}`);

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  if (assignedUserId === null) {
    logger.debug(
      { caseId, requestingUserId: user.id },
      "Unassigning user from case",
    );

    kase.unassignUser({
      text: notes,
      createdBy: user.id,
    });
    return update(kase);
  }

  logger.debug(
    `Validating user assignment - caseId: ${caseId}, userId: ${assignedUserId}`,
  );

  const [userToAssign, workflow] = await Promise.all([
    findUserByIdUseCase(assignedUserId),
    findWorkflowByCodeUseCase(kase.workflowCode),
  ]);

  if (!workflow.requiredRoles.isAuthorised(userToAssign.appRoles)) {
    throw Boom.unauthorized(
      `User with id "${userToAssign.id}" does not have the required permissions to be assigned to this case.`,
    );
  }

  logger.debug(
    `User authorised - caseId: ${caseId}, userId: ${assignedUserId}`,
  );

  kase.assignUser({
    assignedUserId,
    createdBy: user.id,
    text: notes,
  });

  const result = await update(kase);

  logger.info(
    `Finished: Assigning user to case use case started - caseId: ${caseId}`,
  );

  return result;
};
