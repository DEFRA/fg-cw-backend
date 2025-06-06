import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { config } from "../../common/config.js";
import { db } from "../../common/mongo-client.js";
import { CaseDocument } from "../models/case-document.js";
import { Case } from "../models/case.js";

const collection = "cases";

const toCase = (doc) => new Case(doc);

export const save = async (kase) => {
  const caseDocument = new CaseDocument(kase);

  let result;

  try {
    result = await db.collection(collection).insertOne(caseDocument);
  } catch (error) {
    if (error.code === 11000) {
      throw Boom.conflict(
        `Case with caseRef "${kase.caseRef}" and workflowCode "${kase.workflowCode}" already exists`,
      );
    }
    throw error;
  }

  if (!result.acknowledged) {
    throw Boom.internal(
      `Case with caseRef "${kase.caseRef}" and workflowCode "${kase.workflowCode}" could not be created, the operation was not acknowledged`,
    );
  }
};

export const findAll = async (listQuery) => {
  const { page = 1, pageSize = config.get("api.pageSize") ?? 1000 } = listQuery;

  const skip = (page - 1) * pageSize;

  const count = await db.collection(collection).estimatedDocumentCount();

  const pageCount = Math.ceil(count / pageSize);

  const caseDocuments = await db
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
    data: caseDocuments.map(toCase),
  };
};

export const findById = async (caseId) => {
  const caseDocument = await db.collection(collection).findOne({
    _id: ObjectId.createFromHexString(caseId),
  });

  return caseDocument && toCase(caseDocument);
};

export const updateStage = async (caseId, nextStage) => {
  await db
    .collection(collection)
    .updateOne(
      { _id: ObjectId.createFromHexString(caseId) },
      { $set: { currentStage: nextStage } },
    );
};
