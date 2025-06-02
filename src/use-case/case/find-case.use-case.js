import { caseRepository } from "../../repository/case.repository";
import { CaseModel } from "../../models/case-model";
import Boom from "@hapi/boom";

export const findCaseUseCase = async (caseId) => {
  const caseRecord = await caseRepository.findOne(caseId);
  if (caseRecord) {
    return CaseModel.existingCase(caseRecord);
  }

  throw Boom.notFound(`Case with id ${caseId} not found`);
};
