import { Workflow } from "../models/workflow.js";
import { save } from "../repositories/workflow.repository.js";

export const createWorkflowUseCase = async (createWorkflowCommand) => {
  const workflow = new Workflow({
    code: createWorkflowCommand.code,
    payloadDefinition: createWorkflowCommand.payloadDefinition,
    stages: createWorkflowCommand.stages,
    requiredRoles: createWorkflowCommand.requiredRoles,
  });

  await save(workflow);

  return workflow;
};
