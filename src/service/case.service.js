import { caseRepository } from "../repository/case.repository.js";

export const caseService = {
  createCase: async (caseData, db) => {
    return caseRepository.createCase(caseData, db);
  },
  findCases: async (db) => {
    return caseRepository.findCases(db);
  },
  getCase: async (caseId, db) => {
    return caseRepository.getCase(caseId, db);
  }
};
