import { workflowRepository } from "../../repository/workflow.repository";

export const listWorkflowsUseCase = async (listQuery, db) => {
  return workflowRepository.findWorkflows(listQuery, db);
};
