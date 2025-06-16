import { publishCaseStageUpdated } from "../publishers/case-event.publisher.js";
import { updateStage } from "../repositories/case.repository.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";

export const changeCaseStageUseCase = async (caseId) => {
  const kase = await findCaseByIdUseCase(caseId);

  const nextStage = "contract";

  await updateStage(caseId, nextStage);

  await publishCaseStageUpdated({
    caseRef: kase.caseRef,
    previousStage: kase.currentStage,
    currentStage: nextStage,
  });
};
