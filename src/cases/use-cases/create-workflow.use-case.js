import { Permissions } from "../models/permissions.js";
import { WorkflowActionComment } from "../models/workflow-action-comment.js";
import { WorkflowAction } from "../models/workflow-action.js";
import { WorkflowPhase } from "../models/workflow-phase.js";
import { WorkflowStageStatus } from "../models/workflow-stage-status.js";
import { WorkflowStage } from "../models/workflow-stage.js";
import { WorkflowTaskGroup } from "../models/workflow-task-group.js";
import { WorkflowTaskStatusOption } from "../models/workflow-task-status-option.js";
import { WorkflowTask } from "../models/workflow-task.js";
import { Workflow } from "../models/workflow.js";
import { save } from "../repositories/workflow.repository.js";

const createWorkflowTaskStatusOption = (statusOption) =>
  new WorkflowTaskStatusOption({
    code: statusOption.code,
    name: statusOption.name,
    completes: statusOption.completes,
  });

const createWorkflowTask = (task) =>
  new WorkflowTask({
    code: task.code,
    name: task.name,
    description: task.description,
    type: task.type,
    requiredRoles: new Permissions({
      allOf: task.requiredRoles.allOf,
      anyOf: task.requiredRoles.anyOf,
    }),
    statusOptions: task.statusOptions.map(createWorkflowTaskStatusOption),
  });

const createWorkflowTaskGroup = (taskGroup) =>
  new WorkflowTaskGroup({
    code: taskGroup.code,
    name: taskGroup.name,
    description: taskGroup.description,
    tasks: taskGroup.tasks.map(createWorkflowTask),
  });

const createWorkflowStageStatus = (stage) =>
  new WorkflowStageStatus({
    code: stage.code,
    name: stage.name,
    description: stage.description,
  });

const createWorkflowAction = (action) =>
  new WorkflowAction({
    code: action.code,
    name: action.name,
    comment: action.comment
      ? new WorkflowActionComment({
          type: action.comment.type,
          label: action.comment.label,
          helpText: action.comment.helpText,
        })
      : null,
  });

const createWorkflowStage = (stage) =>
  new WorkflowStage({
    code: stage.code,
    name: stage.name,
    description: stage.description,
    actions: stage.actions.map(createWorkflowAction),
    statuses: stage.statuses.map(createWorkflowStageStatus),
    taskGroups: stage.taskGroups.map(createWorkflowTaskGroup),
  });

const createWorkflowPhase = (phase) =>
  new WorkflowPhase({
    code: phase.code,
    name: phase.name,
    stages: phase.stages.map(createWorkflowStage),
  });

export const createWorkflowUseCase = async (createWorkflowCommand) => {
  const workflow = new Workflow({
    code: createWorkflowCommand.code,
    pages: createWorkflowCommand.pages,
    phases: createWorkflowCommand.phases.map(createWorkflowPhase),
    requiredRoles: new Permissions({
      allOf: createWorkflowCommand.requiredRoles.allOf,
      anyOf: createWorkflowCommand.requiredRoles.anyOf,
    }),
    definitions: createWorkflowCommand.definitions,
    externalActions: createWorkflowCommand.externalActions,
  });

  await save(workflow);

  return workflow;
};
