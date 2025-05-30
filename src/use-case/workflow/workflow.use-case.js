import { workflowRepository } from "../../repository/workflow.repository.js";

export const workflowUseCase = {
  findWorkflows: async (listQuery, db) => {
    return workflowRepository.findWorkflows(listQuery, db);
  }
};
