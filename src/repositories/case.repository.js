import Boom from "@hapi/boom";
import { MongoServerError, ObjectId } from "mongodb";
import { db } from "../common/mongo-client.js";
import { config } from "../common/config.js";

export const collection = "cases";

export const caseRepository = {
  createCase: async (caseData) => {
    let result;

    try {
      result = await db.collection(collection).insertOne(caseData);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw Boom.conflict(
          `Case with caseRef "${caseData.caseRef}" and workflowCode "${caseData.workflowCode}" already exists`
        );
      }
      throw error;
    }

    if (!result.acknowledged) {
      throw Boom.internal(
        `Case with caseRef "${caseData.caseRef}" and workflowCode "${caseData.workflowCode}" could not be created, the operation was not acknowledged`
      );
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
  },

  updateStage: async (caseId, nextStage) => {
    return await db.collection(collection).updateOne(
      {
        _id: new ObjectId(caseId)
      },
      { $set: { currentStage: nextStage } }
    );
  }
};
