import Boom from "@hapi/boom";
import { config } from "../../common/config.js";
import { withTransaction } from "../../common/with-transaction.js";
import { CaseStatusUpdatedEvent } from "../events/case-status-updated.event.js";
import { Outbox } from "../models/outbox.js";
import { findById, update } from "../repositories/case.repository.js";
import { insertMany } from "../repositories/outbox.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const updateStageOutcomeUseCase = async (command) => {
  return await withTransaction(async (session) => {
    const { caseId, actionCode, comment, user } = command;
    const kase = await findById(caseId);

    if (!kase) {
      throw Boom.notFound(`Case with id "${caseId}" not found`);
    }

    const workflow = await findByCode(kase.workflowCode);

    workflow.validateStageActionComment({
      actionCode,
      stageCode: kase.currentStage,
      comment,
    });

    kase.updateStageOutcome({
      actionCode,
      comment,
      createdBy: user.id,
    });

    await update(kase, session);

    const { caseRef, workflowCode } = kase;
    // TODO: publish correct currentStatus based on state machine transitions
    const caseStatusEvent = new CaseStatusUpdatedEvent({
      caseRef,
      workflowCode,
      previousStatus: "not-implemented",
      currentStatus: actionCode === "approve" ? "APPROVED" : "not-implemented",
    });

    await insertMany(
      [
        new Outbox({
          event: caseStatusEvent,
          target: config.get("aws.sns.caseStatusUpdatedTopicArn"),
        }),
      ],
      session,
    );
  });
};
