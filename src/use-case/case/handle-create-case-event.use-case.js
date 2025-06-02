import { workflowRepository } from "../../repository/workflow.repository";
import { createCaseUseCase } from "./create-case.use-case";
import Boom from "@hapi/boom";

export const handleCreateCaseEvent = async (caseEvent) => {
  const workflow = await workflowRepository.getWorkflow(caseEvent.code);
  if (!workflow) {
    throw Boom.badRequest(`Workflow ${caseEvent.code} not found`);
  }
  await createCaseUseCase(workflow, caseEvent);
};
