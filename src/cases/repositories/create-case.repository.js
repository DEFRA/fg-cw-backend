import Boom from "@hapi/boom";
import { MongoServerError } from "mongodb";
import { db } from "../../common/mongo-client.js";
import { collection } from "./constants.js";
import { toCase } from "./to-case.js";

export const createCase = async (caseData) => {
  let result;

  try {
    result = await db.collection(collection).insertOne(toCase(caseData));
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
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
  return result;
};
