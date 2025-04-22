import Boom from "@hapi/boom";
import { MongoServerError, ObjectId } from "mongodb";
import { config } from "../config.js";

export const collection = "cases";

export const caseRepository = {
  createCase: async (caseData, db) => {
    let result;
    try {
      result = await db.collection(collection).insertOne(caseData);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw Boom.conflict(
          `Case with workflow code: '${caseData.workflowCode}' and case ref: '${caseData.caseRef}' already exists`
        );
      }
      throw Boom.internal(error);
    }
    if (!result || !result.acknowledged) {
      throw Boom.internal("Error creating case");
    }
    return await db.collection(collection).findOne({
      _id: result.insertedId
    });
  },

  findCases: async (listQuery, db) => {
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

  getCase: async (caseId, db) => {
    return await db.collection(collection).findOne({
      _id: new ObjectId(caseId)
    });
  }
};
