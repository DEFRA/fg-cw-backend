import { findAll } from "../repositories/workflow.repository.js";

export const findWorkflowsUseCase = async (query) => {
  const workflows = await findAll(query);

  return workflows;
};
