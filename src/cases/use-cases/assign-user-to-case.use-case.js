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
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { RequiredAppRoles } from "../models/required-app-roles.js";
import { update } from "../repositories/case.repository.js";
import { loadCase } from "./load-case.js";
import {
  persistResolvedVersion,
  resolveWorkflowForCase,
} from "./resolve-current-workflow.use-case.js";

const assignUserToCase = async (command) => {
  const { assignedUserId, caseId, notes, user } = command;

  logger.info(`Assigning User "${assignedUserId}" to case "${caseId}"`);

  const kase = await loadCase(command);
  const { workflow, resolvedVersion } = await resolveWorkflowForCase(kase);
  await persistResolvedVersion(kase, resolvedVersion);

  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.ReadWrite],
    appRoles: workflow.requiredRoles ?? RequiredAppRoles.None,
  });

  let assignedUser = null;

  if (assignedUserId === null) {
    await unassignUser({ kase, notes, user, caseId });
  } else {
    assignedUser = await assignUser({
      kase,
      notes,
      user,
      caseId,
      assignedUserId,
      workflow,
    });
  }

  logger.info(
    `Finished: Assigning User "${assignedUserId}" to case "${caseId}"`,
  );

  return { assignedUser };
};

export const assignUserToCaseAuditDataBuilder = ([command], result) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.ASSIGN_USER_TO_CASE,
      entityid: command.caseRef ?? command.caseId,
    },
  ],
  details: {
    security: buildSecurityContext(command.user, result?.assignedUser),
    assignedUserId: command.assignedUserId,
  },
  security: buildAuditSecurity(auditActions.ASSIGN_USER_TO_CASE),
  segregationRef: `assign-user-to-case-${command.caseId}`,
});

export const assignUserToCaseUseCase = withAudit(
  assignUserToCase,
  assignUserToCaseAuditDataBuilder,
);

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

  await update(kase);

  return userToAssign;
};
