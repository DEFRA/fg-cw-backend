import Boom from "@hapi/boom";
import { AccessControl } from "../../common/access-control.js";
import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { withTransaction } from "../../common/with-transaction.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { CaseStatusUpdatedEvent } from "../events/case-status-updated.event.js";
import { Outbox } from "../models/outbox.js";
import { findById, update } from "../repositories/case.repository.js";
import { insertMany } from "../repositories/outbox.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const updateStageOutcomeUseCase = async (command) => {
  logger.info(`Updating stage outcome of case "${command.caseId}"`);

  return await withTransaction(async (session) => {
    const { caseId, actionCode, comment, user } = command;
    const kase = await findById(caseId);

    if (!kase) {
      throw Boom.notFound(`Case with id "${caseId}" not found`);
    }

    const workflow = await findByCode(kase.workflowCode);

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
    });

    await insertMany(
      [
        new Outbox({
          event: caseStatusEvent,
          target: config.get("aws.sns.caseStatusUpdatedTopicArn"),
          getSegregationRef: Outbox.getSegregationRef(caseStatusEvent),
        }),
      ],
      session,
    );

    logger.info(`Finished: Updating stage outcome of case "${command.caseId}"`);
  });
};
