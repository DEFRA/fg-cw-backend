import { workflowRepository } from "../../repository/workflow.repository.js";
import { WorkflowModel } from "../../models/workflow-model.js";
import Boom from "@hapi/boom";

export const findWorkflowUseCase = async (code) => {
  const workflow = await workflowRepository.findOne(code);
  if (workflow) {
    return WorkflowModel.existingWorkflow(workflow);
  }

  throw Boom.notFound("Workflow with code " + code + " not found");
};
