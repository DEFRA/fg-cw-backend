import { caseRepository } from "../../repository/case.repository.js";
import { Case } from "../../models/case-model.js";

export const createCaseUseCase = async (caseData) => {
  // const caseData = Case.newCase(createCaseCommand);
  return caseRepository.insert(caseData);
};
