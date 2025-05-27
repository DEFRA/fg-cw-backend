import Boom from "@hapi/boom";
import { MongoServerError, ObjectId } from "mongodb";
import { config } from "../config.js";
import { db } from "../common/helpers/db.js";

export const collection = "cases";

export const caseRepository = {
  insert: async (caseData) => {
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
      throw Boom.internal("Error creating handlers");
    }

    return caseData;
  },

  findCases: async (listQuery) => {
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

  getCase: async (caseId) => {
    return await db.collection(collection).findOne({
      _id: new ObjectId(caseId)
    });
  }
};
