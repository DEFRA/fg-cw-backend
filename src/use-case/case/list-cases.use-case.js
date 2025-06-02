import { caseRepository } from "../../repository/case.repository.js";
import { CaseModel } from "../../models/case-model.js";

export const listCasesUseCase = async (listQuery) => {
  const cases = await caseRepository.findCases(listQuery);
  return cases.data.map((caseItem) => CaseModel.existingCase(caseItem));
};
