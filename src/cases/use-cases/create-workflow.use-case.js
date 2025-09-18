import { Workflow } from "../models/workflow.js";
import { save } from "../repositories/workflow.repository.js";

export const createWorkflowUseCase = async (createWorkflowCommand) => {
  const workflow = new Workflow({
    code: createWorkflowCommand.code,
    pages: createWorkflowCommand.pages,
    stages: createWorkflowCommand.stages,
    requiredRoles: createWorkflowCommand.requiredRoles,
    definitions: createWorkflowCommand.definitions,
  });

  await save(workflow);

  return workflow;
};
