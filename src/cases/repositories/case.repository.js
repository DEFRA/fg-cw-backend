import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { config } from "../../common/config.js";
import { db } from "../../common/mongo-client.js";
import { Case } from "../models/case.js";

const collection = "cases";

const toCase = (doc) => new Case(doc);

export const findAll = async (listQuery) => {
  const { page = 1, pageSize = config.get("api.pageSize") ?? 1000 } = listQuery;
  const skip = (page - 1) * pageSize;
  const count = await db.collection(collection).estimatedDocumentCount();
  const pageCount = Math.ceil(count / pageSize);
  const data = await db
    .collection(collection)
    .find()
    .skip(skip)
    .limit(pageSize)
    .map(toCase)
    .toArray();

  return {
    status: "success",
    metadata: {
      ...listQuery,
      count,
      pageCount,
    },
    data,
  };
};

export const caseRepository = {
  createCase: async (caseData) => {
    let result;

    try {
      result = await db.collection(collection).insertOne(caseData);
    } catch (error) {
      if (error.code === 11000) {
        throw Boom.conflict(
          `Case with caseRef "${caseData.caseRef}" and workflowCode "${caseData.workflowCode}" already exists`,
        );
      }
      throw error;
    }

    if (!result.acknowledged) {
      throw Boom.internal(
        `Case with caseRef "${caseData.caseRef}" and workflowCode "${caseData.workflowCode}" could not be created, the operation was not acknowledged`,
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
    const data = await db
      .collection(collection)
      .find()
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return {
      status: "success",
      metadata: {
        ...listQuery,
        count,
        pageCount,
      },
      data,
    };
  },

  getCase: async (caseId) => {
    return await db.collection(collection).findOne({
      _id: new ObjectId(caseId),
    });
  },

  updateStage: async (caseId, nextStage) => {
    return await db.collection(collection).updateOne(
      {
        _id: new ObjectId(caseId),
      },
      { $set: { currentStage: nextStage } },
    );
  },
};
