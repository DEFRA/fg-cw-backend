import Boom from "@hapi/boom";
import { MongoServerError } from "mongodb";
import { config } from "../config.js";
import { db } from "../common/helpers/db.js";

export const collection = "workflows";

export const workflowRepository = {
  insert: async (workflowData) => {
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

  findOne: async (code) => {
    return await db.collection(collection).findOne({ code });
  }
};
