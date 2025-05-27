import { caseRepository } from "../../repository/case.repository.js";
import { CaseClass } from "../../models/case-model.js";

export const createCaseUseCase = async (createCaseCommand) => {
  const caseData = CaseClass.newCase(createCaseCommand);
  return caseRepository.insert(caseData);
};
