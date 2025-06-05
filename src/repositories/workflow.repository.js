import Boom from "@hapi/boom";
import { config } from "../common/config.js";
import { db } from "../common/mongo-client.js";

export const collection = "workflows";

export const workflowRepository = {
  createWorkflow: async (workflow) => {
    let result;

    try {
      result = await db.collection(collection).insertOne(workflow);
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
  },

  findWorkflows: async (listQuery) => {
    const { page = 1, pageSize = config.get("api.pageSize") ?? 1000 } =
      listQuery;
    const skip = (page - 1) * pageSize;
    const count = await db.collection(collection).estimatedDocumentCount();
    const pageCount = Math.ceil(count / pageSize);
    return {
      status: "success",
      metadata: {
        ...listQuery,
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
  },

  getWorkflow: async (code) => {
    return await db.collection(collection).findOne({
      code,
    });
  },
};
