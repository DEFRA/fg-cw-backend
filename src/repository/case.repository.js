import Boom from "@hapi/boom";
import { MongoServerError } from "mongodb";

export const collection = "cases";

export const caseRepository = {
  createCase: async (caseData, db) => {
    let result;
    try {
      result = await db.collection(collection).insertOne(caseData);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw Boom.conflict(`Case with id: ${caseData.id} already exists`);
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
  findCases: async (db) => {
    return await db.collection(collection).find().toArray();
  },
  getCase: async (caseId, db) => {
    return await db.collection(collection).findOne({
      id: caseId
    });
  }
};
