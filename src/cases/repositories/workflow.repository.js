import Boom from "@hapi/boom";
import { db } from "../../common/mongo-client.js";
import { WorkflowDocument } from "../models/workflow-document.js";
import { Workflow } from "../models/workflow.js";

const collection = "workflows";

const toWorkflow = (doc) =>
  new Workflow({
    _id: doc._id.toHexString(),
    code: doc.code,
    payloadDefinition: doc.payloadDefinition,
    stages: doc.stages,
    requiredRoles: doc.requiredRoles,
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

export const findAll = async (query) => {
  const filter = {};

  if (query?.codes?.length) {
    filter.code = {
      $in: query.codes,
    };
  }

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
