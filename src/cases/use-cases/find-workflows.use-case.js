import { findAll } from "../repositories/workflow.repository.js";

export const findWorkflowsUseCase = async () => {
  return await findAll();
};
