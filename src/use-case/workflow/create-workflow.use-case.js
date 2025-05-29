import { workflowRepository } from "../../repository/workflow.repository.js";
import { WorkflowModel } from "../../models/workflow-model.js";

export const createWorkflowUseCase = async (createWorkflowCommand) => {
  return workflowRepository.insert(
    WorkflowModel.newWorkflow(createWorkflowCommand)
  );
};
