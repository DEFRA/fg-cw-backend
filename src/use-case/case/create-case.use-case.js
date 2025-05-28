import { caseRepository } from "../../repository/case.repository.js";
import { CaseModel } from "../../models/case-model.js";

export const createCaseUseCase = async (createCaseCommand) => {
  const caseData = CaseModel.newCase(createCaseCommand);
  await caseRepository.insert(caseData);
};
