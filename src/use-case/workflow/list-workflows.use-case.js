import { WorkflowModel } from "../../models/workflow-model";
import { workflowRepository } from "../../repository/workflow.repository";

export const listWorkflowsUseCase = async (listQuery) => {
  const workflows = await workflowRepository.findWorkflows(listQuery);
  return workflows.data.map((workflowItem) =>
    WorkflowModel.existingWorkflow(workflowItem)
  );
};
