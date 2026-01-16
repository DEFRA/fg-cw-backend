import Boom from "@hapi/boom";
import { AccessControl } from "../../common/access-control.js";
import { logger } from "../../common/logger.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { RequiredAppRoles } from "../models/required-app-roles.js";
import { findById, update } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

export const assignUserToCaseUseCase = async (command) => {
  const { assignedUserId, caseId, notes, user } = command;

  logger.info(`Assigning User "${assignedUserId}" to case "${caseId}"`);

  const kase = await loadCase(caseId);
  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);

  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.ReadWrite],
    appRoles: workflow.requiredRoles ?? RequiredAppRoles.None,
  });

  if (assignedUserId === null) {
    await unassignUser({ kase, notes, user, caseId });
  } else {
    await assignUser({ kase, notes, user, caseId, assignedUserId, workflow });
  }

  logger.info(
    `Finished: Assigning User "${assignedUserId}" to case "${caseId}"`,
  );
};

const loadCase = async (caseId) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  return kase;
};

const unassignUser = async ({ kase, notes, user }) => {
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
  const userToAssign = await findUserByIdUseCase(assignedUserId);

  if (
    !AccessControl.canAccess(userToAssign, {
      idpRoles: [],
      appRoles: workflow.requiredRoles,
    })
  ) {
    throw Boom.unauthorized(
      `User ${userToAssign.id} does not have access to case ${caseId}`,
    );
  }

  kase.assignUser({
    assignedUserId,
    createdBy: user.id,
    text: notes,
  });

  return update(kase);
};
