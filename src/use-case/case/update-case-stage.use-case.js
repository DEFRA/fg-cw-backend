import { caseRepository } from "../../repository/case.repository";

export const updateCaseStageUseCase = async (caseId, nextStage) => {
  await caseRepository.updateCaseStage(caseId, nextStage);
};
