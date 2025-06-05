import { collection } from "./constants.js";
import { db } from "../../common/mongo-client.js";
import { ObjectId } from "mongodb";

export const updateStage = async (caseId, nextStage) => {
  return await db.collection(collection).updateOne(
    {
      _id: new ObjectId(caseId)
    },
    { $set: { currentStage: nextStage } }
  );
};
