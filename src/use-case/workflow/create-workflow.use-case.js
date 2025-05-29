import { workflowRepository } from "../../repository/workflow.repository.js";
import { WorkflowModel } from "../../models/workflow-model.js";

export const createWorkflowUseCase = async (createWorkflowCommand) => {
  const workflowData = WorkflowModel.newWorkflow(createWorkflowCommand);
  await workflowRepository.insert(workflowData);
};
