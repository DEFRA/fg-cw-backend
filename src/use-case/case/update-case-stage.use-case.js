import { caseRepository } from "../../repository/case.repository";
import Boom from "@hapi/boom";

export const updateCaseStageUseCase = async (caseId, nextStage) => {
  const caseDetail = await caseRepository.updateCaseStage(caseId, nextStage);
  if (!caseDetail) {
    throw Boom.notFound("Case with id " + caseId + " not found");
  }
  return caseDetail;
};
