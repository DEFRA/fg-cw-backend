import Boom from "@hapi/boom";
import { actuatorReadMaxTimeMs } from "../../common/actuator-read.js";
import { db } from "../../common/mongo-client.js";
import { CaseSeries } from "../models/case-series.js";
import { seriesFilter } from "./case/admin-case-query.js";

const collection = "case_series";

export const save = async (series, session) => {
  const document = series.toDocument();
  const result = await db
    .collection(collection)
    .insertOne(document, { session });
  return result;
};

export const findInCaseRefsAndWorkflowCode = async (caseRef, workflowCode) => {
  const doc = await db
    .collection(collection)
    .findOne({ caseRefs: caseRef, workflowCode });
  if (doc === null) {
    throw Boom.notFound();
  }
  return CaseSeries.fromDocument(doc);
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

// Plain documents for the admin read model: every series the ref is in, under
// one workflow when one is given.
export const findByCaseRef = ({ ref, workflowCode }) =>
  db
    .collection(collection)
    .find(seriesFilter({ ref, workflowCode }), {
      projection: { _id: 0, workflowCode: 1, caseRefs: 1, latestCaseRef: 1 },
      maxTimeMS: actuatorReadMaxTimeMs(),
    })
    .toArray();
