import Boom from "@hapi/boom";

import { publishCaseStatusUpdated } from "../publishers/case-event.publisher.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const updateStageOutcomeUseCase = async (command) => {
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

  await update(kase);

  // TODO: publish correct currentStatus based on state machine transitions
  await publishCaseStatusUpdated({
    caseRef: kase.caseRef,
    workflowCode: kase.workflowCode,
    previousStatus: "not-implemented",
    currentStatus: actionCode === "approve" ? "APPROVED" : "not-implemented",
  });
};
