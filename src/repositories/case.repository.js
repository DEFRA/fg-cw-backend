import { ObjectId } from "mongodb";
import { db } from "../common/mongo-client.js";
import { collection } from "../cases/repositories/constants.js";

export const caseRepository = {
  updateStage: async (caseId, nextStage) => {
    return await db.collection(collection).updateOne(
      {
        _id: new ObjectId(caseId)
      },
      { $set: { currentStage: nextStage } }
    );
  }
};
