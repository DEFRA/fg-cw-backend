import { ObjectId } from "mongodb";
import { db } from "../../common/mongo-client.js";
import { collection } from "./constants.js";

export const findCase = async (caseId) => {
  return await db.collection(collection).findOne({ _id: new ObjectId(caseId) });
};
