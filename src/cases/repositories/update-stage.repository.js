import { ObjectId } from "mongodb";
import { db } from "../../common/mongo-client.js";
import { collection } from "./constants.js";

export const updateStage = async (caseId, nextStage) => {
  return await db.collection(collection).updateOne(
    {
      _id: ObjectId.createFromHexString(caseId),
    },
    { $set: { currentStage: nextStage } },
  );
};
