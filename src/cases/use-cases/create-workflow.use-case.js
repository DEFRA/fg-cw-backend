import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { Permissions } from "../models/permissions.js";
import { Position } from "../models/position.js";
import { WorkflowActionComment } from "../models/workflow-action-comment.js";
import { WorkflowAction } from "../models/workflow-action.js";
import { WorkflowEndpoint } from "../models/workflow-endpoint.js";
import { WorkflowPhase } from "../models/workflow-phase.js";
import { WorkflowStageStatus } from "../models/workflow-stage-status.js";
import { WorkflowStage } from "../models/workflow-stage.js";
import { WorkflowTaskGroup } from "../models/workflow-task-group.js";
import { WorkflowTaskStatusOption } from "../models/workflow-task-status-option.js";
import { WorkflowTask } from "../models/workflow-task.js";
import { WorkflowTransition } from "../models/workflow-transition.js";
import { Workflow } from "../models/workflow.js";
import { save } from "../repositories/workflow.repository.js";

const findPhaseOrThrow = (phases, phaseCode) => {
  const phase = phases.find((p) => p.code === phaseCode);
  if (!phase) {
    throw Boom.badData(`Phase '${phaseCode}' not found in workflow`);
  }
  return phase;
};

const findStageOrThrow = (phase, stageCode, phaseCode) => {
  const stage = phase.stages.find((s) => s.code === stageCode);
  if (!stage) {
    throw Boom.badData(
      `Stage '${stageCode}' not found in phase '${phaseCode}'`,
    );
  }
  return stage;
};

const findStatusOrThrow = (stage, statusCode, stageCode) => {
  const status = stage.statuses.find((s) => s.code === statusCode);
  if (!status) {
    throw Boom.badData(
      `Status '${statusCode}' not found in stage '${stageCode}'`,
    );
  }
  return status;
};

const resolveStageCode = (stageCode, phaseCode, targetPhase, context) => {
  if (stageCode) {
    return stageCode;
  }

  if (phaseCode) {
    return targetPhase.stages[0]?.code;
  }

  return context.stageCode;
};

const resolveStatusCode = (
  statusCode,
  targetStage,
  resolvedStageCode,
  resolvedPhaseCode,
) => {
  const resolvedStatusCode = statusCode || targetStage.statuses[0]?.code;

  if (!resolvedStatusCode) {
    throw Boom.badData(
      `No status found for stage '${resolvedStageCode}' in phase '${resolvedPhaseCode}'`,
    );
  }

  findStatusOrThrow(targetStage, resolvedStatusCode, resolvedStageCode);
  return resolvedStatusCode;
};

const resolveTargetPosition = ({ targetPosition, context, phases }) => {
  if (targetPosition === "::") {
    throw Boom.badData("Target position '::' is not valid");
  }

  const [phaseCode, stageCode, statusCode] = targetPosition.split(":");
  const resolvedPhaseCode = phaseCode || context.phaseCode;
  const targetPhase = findPhaseOrThrow(phases, resolvedPhaseCode);
  const resolvedStageCode = resolveStageCode(
    stageCode,
    phaseCode,
    targetPhase,
    context,
  );

  const targetStage = findStageOrThrow(
    targetPhase,
    resolvedStageCode,
    resolvedPhaseCode,
  );

  const resolvedStatusCode = resolveStatusCode(
    statusCode,
    targetStage,
    resolvedStageCode,
    resolvedPhaseCode,
  );

  return new Position({
    phaseCode: resolvedPhaseCode,
    stageCode: resolvedStageCode,
    statusCode: resolvedStatusCode,
  });
};

const createWorkflowTaskStatusOption = (statusOption) =>
  new WorkflowTaskStatusOption({
    code: statusOption.code,
    name: statusOption.name,
    theme: statusOption.theme,
    altName: statusOption.altName,
    completes: statusOption.completes,
  });

const createWorkflowTask = (task) =>
  new WorkflowTask({
    code: task.code,
    name: task.name,
    mandatory: task.mandatory,
    description: task.description,
    requiredRoles: task.requiredRoles
      ? new Permissions({
          allOf: task.requiredRoles.allOf,
          anyOf: task.requiredRoles.anyOf,
        })
      : null,
    statusOptions: task.statusOptions.map(createWorkflowTaskStatusOption),
    comment: task.comment,
  });

const createWorkflowTaskGroup = (taskGroup) =>
  new WorkflowTaskGroup({
    code: taskGroup.code,
    name: taskGroup.name,
    description: taskGroup.description,
    tasks: taskGroup.tasks.map(createWorkflowTask),
  });

const createWorkflowAction = (action) =>
  new WorkflowAction({
    code: action.code,
    name: action.name,
    checkTasks: action.checkTasks,
    comment: action.comment
      ? new WorkflowActionComment({
          label: action.comment.label,
          helpText: action.comment.helpText,
          mandatory: action.comment.mandatory,
        })
      : null,
  });

const createWorkflowTransition = (transition, context, phases) =>
  new WorkflowTransition({
    targetPosition: resolveTargetPosition({
      targetPosition: transition.targetPosition,
      context,
      phases,
    }),
    checkTasks: transition.checkTasks,
    action: transition.action ? createWorkflowAction(transition.action) : null,
  });

const createWorkflowStageStatus = (status, context, phases) =>
  new WorkflowStageStatus({
    code: status.code,
    name: status.name,
    theme: status.theme,
    description: status.description,
    interactive: status.interactive,
    transitions: status.transitions.map((transition) =>
      createWorkflowTransition(
        transition,
        { ...context, statusCode: status.code },
        phases,
      ),
    ),
  });

const createWorkflowStage = (stage, context, phases) =>
  new WorkflowStage({
    code: stage.code,
    name: stage.name,
    description: stage.description,
    statuses: stage.statuses.map((status) =>
      createWorkflowStageStatus(
        status,
        { ...context, stageCode: stage.code },
        phases,
      ),
    ),
    taskGroups: stage.taskGroups.map(createWorkflowTaskGroup),
    beforeContent: stage.beforeContent,
  });

const createWorkflowPhase = (phase, phases) =>
  new WorkflowPhase({
    code: phase.code,
    name: phase.name,
    stages: phase.stages.map((stage) =>
      createWorkflowStage(stage, { phaseCode: phase.code }, phases),
    ),
  });

export const createWorkflowUseCase = async (createWorkflowCommand) => {
  logger.info(`Creating workflow with code '${createWorkflowCommand.code}'`);

  const workflow = new Workflow({
    code: createWorkflowCommand.code,
    pages: createWorkflowCommand.pages,
    phases: createWorkflowCommand.phases.map((phase) =>
      createWorkflowPhase(phase, createWorkflowCommand.phases),
    ),
    requiredRoles: new Permissions({
      allOf: createWorkflowCommand.requiredRoles.allOf,
      anyOf: createWorkflowCommand.requiredRoles.anyOf,
    }),
    definitions: createWorkflowCommand.definitions,
    externalActions: createWorkflowCommand.externalActions,
    endpoints: createWorkflowCommand.endpoints?.map(createWorkflowEndpoint),
  });

  await save(workflow);

  logger.info(`Finished: Workflow created with code '${workflow.code}'`);

  return workflow;
};

const createWorkflowEndpoint = (endpoint) =>
  new WorkflowEndpoint({
    code: endpoint.code,
    service: endpoint.service,
    path: endpoint.path,
    method: endpoint.method,
    request: endpoint.request,
  });
