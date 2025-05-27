import { workflowRepository } from "../../repository/workflow.repository.js";

export const workflowUseCase = {
  createWorkflow: async (workflowData, db) => {
    return workflowRepository.createWorkflow(workflowData, db);
  },
  findWorkflows: async (listQuery, db) => {
    return workflowRepository.findWorkflows(listQuery, db);
  },
  getWorkflow: async (code, db) => {
    return workflowRepository.getWorkflow(code, db);
  }
};
