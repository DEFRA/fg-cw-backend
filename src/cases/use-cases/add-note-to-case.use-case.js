import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { AccessControl } from "../models/access-control.js";
import { RequiredAppRoles } from "../models/required-app-roles.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const addNoteToCaseUseCase = async (command) => {
  const { caseId, text, user } = command;

  logger.info(
    `Adding note to case use case started - caseId: ${caseId}, userId: ${user.id}`,
  );

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const workflow = await findByCode(kase.workflowCode);

  if (!workflow) {
    throw Boom.notFound(`Workflow not found: ${kase.workflowCode}`);
  }

  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.ReadWrite],
    appRoles: workflow.requiredRoles ?? RequiredAppRoles.None,
  });

  const note = kase.addNote({
    text,
    createdBy: user.id,
  });

  await update(kase);

  logger.info(
    `Finished: Adding note to case use case started - caseId: ${caseId}, userId: ${user.id}, noteRef: ${note.ref}`,
  );

  return note;
};
