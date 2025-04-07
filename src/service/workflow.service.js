import { workflowRepository } from "../repository/workflow.repository.js";

export const workflowService = {
  createWorkflow: async (workflowData, db) => {
    return workflowRepository.createWorkflow(workflowData, db);
  },
  findWorkflows: async (listQuery, db) => {
    return workflowRepository.findWorkflows(listQuery, db);
  },
  getWorkflow: async (workflowCode, db) => {
    return workflowRepository.getWorkflow(workflowCode, db);
  }
};
