import Boom from "@hapi/boom";
import { findByCode } from "../repositories/workflow.repository.js";

export const findWorkflowByCodeUseCase = async (code) => {
  const workflow = await findByCode(code);

  if (!workflow) {
    throw Boom.notFound(`Workflow with code "${code}" not found`);
  }

  return workflow;
};
