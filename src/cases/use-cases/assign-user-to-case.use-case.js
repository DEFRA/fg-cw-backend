import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { AccessControl } from "../models/access-control.js";
import { RequiredAppRoles } from "../models/required-app-roles.js";
import { findById, update } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

const loadCase = async (caseId) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  return kase;
};

const authoriseActor = (user, workflow) => {
  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.ReadWrite],
    appRoles: workflow.requiredRoles ?? RequiredAppRoles.None,
  });
};

const unassignUser = async ({ kase, notes, user, caseId }) => {
  logger.debug(`Unassigning user ${user.id} from case - caseId: ${caseId}`);

  kase.unassignUser({
    text: notes,
    createdBy: user.id,
  });

  return update(kase);
};

const assignUser = async ({
  kase,
  notes,
  user,
  caseId,
  assignedUserId,
  workflow,
}) => {
  logger.debug(
    `Validating user assignment - caseId: ${caseId}, userId: ${assignedUserId}`,
  );

  const userToAssign = await findUserByIdUseCase(assignedUserId);

  if (
    !AccessControl.canAccess(userToAssign, {
      idpRoles: [],
      appRoles: workflow.requiredRoles,
    })
  ) {
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

  return update(kase);
};

export const assignUserToCaseUseCase = async (command) => {
  const { assignedUserId, caseId, notes, user } = command;

  logger.info(`Assigning user to case use case started - caseId: ${caseId}`);

  const kase = await loadCase(caseId);
  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);

  authoriseActor(user, workflow);

  if (assignedUserId === null) {
    return unassignUser({ kase, notes, user, caseId });
  }

  return assignUser({ kase, notes, user, caseId, assignedUserId, workflow });
};
