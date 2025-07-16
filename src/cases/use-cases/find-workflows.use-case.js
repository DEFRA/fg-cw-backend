import { findAll } from "../repositories/workflow.repository.js";

export const findWorkflowsUseCase = async (query) => {
  return await findAll(query);
};
