import Boom from "@hapi/boom";
import { db } from "../../common/mongo-client.js";
import { WorkflowDocument } from "../models/workflow-document.js";
import { Workflow } from "../models/workflow.js";

const collection = "workflows";

const toWorkflow = (doc) =>
  new Workflow({
    _id: doc._id.toHexString(),
    code: doc.code,
    pages: doc.pages,
    stages: doc.stages,
    requiredRoles: doc.requiredRoles,
    definitions: doc.definitions,
    externalActions: doc.externalActions,
  });

export const save = async (workflow) => {
  const workflowDocument = new WorkflowDocument(workflow);

  let result;

  try {
    result = await db.collection(collection).insertOne(workflowDocument);
  } catch (error) {
    if (error.code === 11000) {
      throw Boom.conflict(
        `Workflow with code "${workflow.code}" already exists`,
      );
    }
    throw error;
  }

  if (!result.acknowledged) {
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

  return filter;
};

export const findAll = async (query) => {
  const filter = createWorkflowFilter(query);

  const workflowDocuments = await db
    .collection(collection)
    .find(filter)
    .toArray();

  return workflowDocuments.map(toWorkflow);
};

export const findByCode = async (code) => {
  const workflowDocument = await db.collection(collection).findOne({
    code,
  });

  return workflowDocument && toWorkflow(workflowDocument);
};
