import { caseRepository } from "../../repository/case.repository";
import { CaseModel } from "../../model/case.model";

export const listCasesUseCase = async (listQuery) => {
  const cases = await caseRepository.findCases(listQuery);
  return cases.data.map((caseItem) => CaseModel.existingCase(caseItem));
};
