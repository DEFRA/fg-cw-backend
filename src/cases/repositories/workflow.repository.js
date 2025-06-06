import Boom from "@hapi/boom";
import { config } from "../../common/config.js";
import { db } from "../../common/mongo-client.js";
import { WorkflowDocument } from "../models/workflow-document.js";

const collection = "workflows";

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

  return workflow;
};

export const findAll = async (query) => {
  const { page = 1, pageSize = config.get("api.pageSize") ?? 1000 } = query;

  const skip = (page - 1) * pageSize;

  const count = await db.collection(collection).estimatedDocumentCount();

  const pageCount = Math.ceil(count / pageSize);

  return {
    status: "success",
    metadata: {
      ...query,
      count,
      pageCount,
    },

    data: await db
      .collection(collection)
      .find()
      .skip(skip)
      .limit(pageSize)
      .toArray(),
  };
};

export const findByCode = async (code) => {
  const result = await db.collection(collection).findOne({
    code,
  });

  return result;
};
