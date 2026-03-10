import Boom from "@hapi/boom";
import { db } from "../../common/mongo-client.js";
import { CaseSeries } from "../models/case-series.js";

const collection = "case_series";

export const save = async (series, session) => {
  const document = series.toDocument();
  const result = await db
    .collection(collection)
    .insertOne(document, { session });
  return result;
};

export const findByCaseRefAndWorkflowCode = async (
  caseRef,
  workflowCode,
  session,
) => {
  const doc = await db
    .collection(collection)
    .findOne({ latestCaseRef: caseRef, workflowCode }, { session });

  if (doc === null) {
    throw Boom.notFound(
      `Case Series with latestCaseRef "${caseRef}" and workflowCode "${workflowCode}" not found.`,
    );
  }

  return CaseSeries.fromDocument(doc);
};

export const update = async (series, session) => {
  const document = series.toDocument();
  const result = await db
    .collection(collection)
    .replaceOne({ _id: series._id }, document, { session });
  if (result.modifiedCount === 0) {
    throw Boom.notFound(
      `Failed to update case_series with _id "${series._id}"`,
    );
  }
  return result;
};
