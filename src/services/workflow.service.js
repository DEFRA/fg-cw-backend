import { workflowRepository } from "../repositories/workflow.repository.js";

export const workflowService = {
  createWorkflow: async (workflowData) => {
    return workflowRepository.createWorkflow(workflowData);
  },
  findWorkflows: async (listQuery) => {
    return workflowRepository.findWorkflows(listQuery);
  },
  getWorkflow: async (code) => {
    return workflowRepository.getWorkflow(code);
  }
};
