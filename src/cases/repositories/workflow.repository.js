import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { db } from "../../common/mongo-client.js";
import { Permissions } from "../models/permissions.js";
import { Position } from "../models/position.js";
import { WorkflowActionComment } from "../models/workflow-action-comment.js";
import { WorkflowAction } from "../models/workflow-action.js";
import { WorkflowEndpoint } from "../models/workflow-endpoint.js";
import { WorkflowPhase } from "../models/workflow-phase.js";
import { WorkflowStageStatus } from "../models/workflow-stage-status.js";
import { WorkflowStage } from "../models/workflow-stage.js";
import { WorkflowTaskComment } from "../models/workflow-task-comment.js";
import { WorkflowTaskGroup } from "../models/workflow-task-group.js";
import { WorkflowTaskStatusOption } from "../models/workflow-task-status-option.js";
import { WorkflowTask } from "../models/workflow-task.js";
import { WorkflowTransition } from "../models/workflow-transition.js";
import { Workflow } from "../models/workflow.js";
import { WorkflowDocument } from "./workflow/workflow-document.js";

const collection = "workflows";

const toWorkflowAction = (a) =>
  new WorkflowAction({
    code: a.code,
    name: a.name,
    checkTasks: a.checkTasks,
    comment: a.comment
      ? new WorkflowActionComment({
          label: a.comment.label,
          helpText: a.comment.helpText,
          mandatory: a.comment.mandatory,
        })
      : null,
  });

const toWorkflowTransition = (t) =>
  new WorkflowTransition({
    targetPosition: Position.from(t.targetPosition),
    action: t.action ? toWorkflowAction(t.action) : null,
  });

const toWorkflowStageStatus = (s) =>
  new WorkflowStageStatus({
    code: s.code,
    name: s.name,
    description: s.description,
    interactive: s.interactive,
    transitions: s.transitions.map(toWorkflowTransition),
  });

const toWorkflowTaskStatusOption = (so) =>
  new WorkflowTaskStatusOption({
    code: so.code,
    name: so.name,
    completes: so.completes,
  });

const toWorkflowTaskComment = (tc) =>
  tc
    ? new WorkflowTaskComment({
        label: tc.label,
        helpText: tc.helpText,
        mandatory: tc.mandatory,
      })
    : null;

const toWorkflowTask = (t) =>
  new WorkflowTask({
    code: t.code,
    name: t.name,
    mandatory: t.mandatory,
    description: t.description,
    requiredRoles: t.requiredRoles
      ? new Permissions({
          allOf: t.requiredRoles.allOf,
          anyOf: t.requiredRoles.anyOf,
        })
      : null,
    statusOptions: t.statusOptions.map(toWorkflowTaskStatusOption),
    comment: toWorkflowTaskComment(t.comment),
  });

const toWorkflowTaskGroup = (tg) =>
  new WorkflowTaskGroup({
    code: tg.code,
    name: tg.name,
    description: tg.description,
    tasks: tg.tasks.map(toWorkflowTask),
  });

const toWorkflowStage = (s) =>
  new WorkflowStage({
    code: s.code,
    name: s.name,
    description: s.description,
    statuses: s.statuses.map(toWorkflowStageStatus),
    taskGroups: s.taskGroups.map(toWorkflowTaskGroup),
  });

const toWorkflowPhase = (p) =>
  new WorkflowPhase({
    code: p.code,
    name: p.name,
    stages: p.stages.map(toWorkflowStage),
  });

const toWorkflowEndpoint = (endpoint) =>
  new WorkflowEndpoint({
    code: endpoint.code,
    service: endpoint.service,
    path: endpoint.path,
    method: endpoint.method,
    request: endpoint.request,
  });

const toWorkflow = (doc) =>
  new Workflow({
    _id: doc._id.toHexString(),
    code: doc.code,
    pages: doc.pages,
    phases: doc.phases.map(toWorkflowPhase),
    requiredRoles: new Permissions({
      allOf: doc.requiredRoles.allOf,
      anyOf: doc.requiredRoles.anyOf,
    }),
    definitions: doc.definitions,
    externalActions: doc.externalActions,
    endpoints: doc.endpoints?.map(toWorkflowEndpoint) || [],
  });

export const save = async (workflow) => {
  logger.debug("Saving workflow", {
    code: workflow.code,
    phasesCount: workflow.phases.length,
  });

  const workflowDocument = new WorkflowDocument(workflow);

  let result;

  try {
    result = await db.collection(collection).insertOne(workflowDocument);
    logger.debug("Workflow saved successfully", {
      code: workflow.code,
      insertedId: result.insertedId,
    });
  } catch (error) {
    if (error.code === 11000) {
      logger.debug("Workflow save failed - duplicate code", {
        code: workflow.code,
      });
      throw Boom.conflict(
        `Workflow with code "${workflow.code}" already exists`,
      );
    }
    logger.debug("Workflow save failed with unexpected error", {
      code: workflow.code,
      error: error.message,
    });
    throw error;
  }

  if (!result.acknowledged) {
    logger.debug("Workflow save not acknowledged", { code: workflow.code });
    throw Boom.internal(
      `Workflow with code "${workflow.code}" could not be created, the operation was not acknowledged`,
    );
  }
};

// eslint-disable-next-line complexity
export const createWorkflowFilter = (query = {}) => {
  const { codes, $expr } = query;
  const filter = {};

  if (codes?.length) {
    filter.code = {
      $in: codes,
    };
  }

  if ($expr) {
    filter.$expr = $expr;
  }

  logger.debug("Created workflow filter", { filter, originalQuery: query });
  return filter;
};

export const findAll = async (query) => {
  logger.debug("Finding all workflows", { query });

  const filter = createWorkflowFilter(query);

  const workflowDocuments = await db
    .collection(collection)
    .find(filter)
    .toArray();

  logger.debug("Workflows found", { count: workflowDocuments.length, query });
  return workflowDocuments.map(toWorkflow);
};

export const findByCode = async (code) => {
  logger.debug("Finding workflow by code", { code });

  const workflowDocument = await db.collection(collection).findOne({
    code,
  });

  const found = !!workflowDocument;
  logger.debug("Workflow search result", { code, found });

  return workflowDocument && toWorkflow(workflowDocument);
};
