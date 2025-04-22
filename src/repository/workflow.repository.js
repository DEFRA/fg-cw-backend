import Boom from "@hapi/boom";
import { MongoServerError } from "mongodb";
import { config } from "../config.js";

export const collection = "workflows";

export const workflowRepository = {
  createWorkflow: async (workflowData, db) => {
    let result;
    try {
      result = await db.collection(collection).insertOne(workflowData);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw Boom.conflict(
          `Workflow with code: ${workflowData.code} already exists`
        );
      }
      throw Boom.internal(error);
    }
    if (!result || !result.acknowledged) {
      throw Boom.internal("Error creating workflow");
    }
    return await db.collection(collection).findOne({
      _id: result.insertedId
    });
  },

  findWorkflows: async (listQuery, db) => {
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
        pageCount
      },

      data: await db
        .collection(collection)
        .find()
        .skip(skip)
        .limit(pageSize)
        .toArray()
    };
  },

  getWorkflow: async (workflowCode, db) => {
    return await db.collection(collection).findOne({
      workflowCode
    });
  }
};
