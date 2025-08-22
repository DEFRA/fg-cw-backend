import Boom from "@hapi/boom";

import { getAuthenticatedUser } from "../../common/auth.js";
import { publishCaseStageUpdated } from "../publishers/case-event.publisher.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const updateStageOutcomeUseCase = async ({
  caseId,
  actionId,
  comment,
}) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const workflow = await findByCode(kase.workflowCode);

  workflow.validateStageActionComment({
    actionId,
    stageId: kase.currentStage,
    comment,
  });

  const previousStage = kase.currentStage;
  kase.updateStageOutcome({
    actionId,
    comment,
    createdBy: getAuthenticatedUser().id,
  });

  await update(kase);

  await publishCaseStageUpdated({
    caseRef: kase.caseRef,
    previousStage,
    currentStage: kase.currentStage,
  });
};
