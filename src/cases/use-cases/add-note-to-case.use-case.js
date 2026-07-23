import Boom from "@hapi/boom";
import { AccessControl } from "../../common/access-control.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { logger } from "../../common/logger.js";
import { withAudit } from "../../common/with-audit.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { RequiredAppRoles } from "../models/required-app-roles.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

const addNoteToCase = async (command) => {
  const { caseId, text, user } = command;

  logger.info(`Adding a note to case "${caseId}"`);

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

  logger.info(`Note with nodeRef "${note.ref}" created by User "${user.id}"`);

  logger.info(`Finished: Adding a note to case "${caseId}"`);

  return note;
};

export const addNoteToCaseAuditDataBuilder = ([command], result) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.ADD_NOTE_TO_CASE,
      entityid: command.caseId,
    },
  ],
  details: {
    security: buildSecurityContext(command.user),
    note: { ref: result?.ref },
  },
  security: buildAuditSecurity(auditActions.ADD_NOTE_TO_CASE),
  messageGroupId: `add-note-to-case-${command.caseId}`,
});

export const addNoteToCaseUseCase = withAudit(
  addNoteToCase,
  addNoteToCaseAuditDataBuilder,
);
