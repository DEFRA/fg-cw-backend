import { AccessControl } from "../../common/access-control.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { withAudit } from "../../common/with-audit.js";
import { withTransaction } from "../../common/with-transaction.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { CaseStatusUpdatedEvent } from "../events/case-status-updated.event.js";
import { Outbox } from "../models/outbox.js";
import { update } from "../repositories/case.repository.js";
import { insertMany } from "../repositories/outbox.repository.js";
import { ensureCasePosition } from "./ensure-case-position.use-case.js";
import { loadCase } from "./load-case.js";
import {
  persistResolvedVersion,
  resolveWorkflowForCase,
} from "./resolve-current-workflow.use-case.js";

const updateStageOutcome = async (command, session) => {
  logger.info(`Updating stage outcome of case "${command.caseId}"`);

  const { actionCode, comment, user } = command;
  const kase = await loadCase(command, session);

  const { workflow, resolvedVersion } = await resolveWorkflowForCase(kase);
  await persistResolvedVersion(kase, resolvedVersion);

  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.ReadWrite],
    appRoles: workflow.requiredRoles,
  });

  workflow.validateStageActionComment({
    actionCode,
    position: kase.position,
    comment,
  });

  const previousPosition = kase.position;

  const targetPosition = workflow.getNextPosition(kase.position, actionCode);
  await ensureCasePosition(kase, workflow, targetPosition);

  kase.updateStageOutcome({
    workflow,
    actionCode,
    comment,
    createdBy: user.id,
  });

  await update(kase, session);

  const caseStatusEvent = new CaseStatusUpdatedEvent({
    caseRef: kase.caseRef,
    workflowCode: kase.workflowCode,
    previousStatus: previousPosition.toString(),
    currentStatus: kase.position.toString(),
    currentConfigVersion: kase.currentConfigVersion,
  });

  await insertMany(
    [
      new Outbox({
        event: caseStatusEvent,
        target: config.get("aws.sns.caseStatusUpdatedTopicArn"),
        segregationRef: Outbox.getSegregationRef(caseStatusEvent),
      }),
    ],
    session,
  );

  logger.info(`Finished: Updating stage outcome of case "${command.caseId}"`);
};

export const updateStageOutcomeAuditDataBuilder = ([command]) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.UPDATE_STAGE_OUTCOME,
      entityid: command.caseRef ?? command.caseId,
    },
  ],
  details: {
    security: buildSecurityContext(command.user),
    stage: {
      actionCode: command.actionCode,
      hasComment: Boolean(command.comment),
    },
  },
  security: buildAuditSecurity(auditActions.UPDATE_STAGE_OUTCOME),
  segregationRef: `update-stage-outcome-${command.caseId}`,
});

export const updateStageOutcomeUseCase = (command) =>
  withTransaction((session) =>
    withAudit(updateStageOutcome, updateStageOutcomeAuditDataBuilder)(
      command,
      session,
    ),
  );
