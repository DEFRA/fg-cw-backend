import { workflowRepository } from "../../repository/workflow.repository.js";

export const workflowUseCase = {
  findWorkflows: async (listQuery, db) => {
    return workflowRepository.findWorkflows(listQuery, db);
  },
  getWorkflow: async (code, db) => {
    return workflowRepository.getWorkflow(code, db);
  }
};
