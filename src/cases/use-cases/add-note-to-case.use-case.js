import Boom from "@hapi/boom";
import { AccessControl } from "../../common/access-control.js";
import { logger } from "../../common/logger.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { RequiredAppRoles } from "../models/required-app-roles.js";
import { findById, update } from "../repositories/case.repository.js";
import {
  persistResolvedVersion,
  resolveWorkflowForCase,
} from "./resolve-current-workflow.use-case.js";

export const addNoteToCaseUseCase = async (command) => {
  const { caseId, text, user } = command;

  logger.info(`Adding a note to case "${caseId}"`);

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const { workflow, resolvedVersion } = await resolveWorkflowForCase(kase);
  await persistResolvedVersion(kase, resolvedVersion);

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

  logger.info(`Note with nodeRef "${note.ref}" created by User "${user.id}"`);

  logger.info(`Finished: Adding a note to case "${caseId}"`);

  return note;
};
