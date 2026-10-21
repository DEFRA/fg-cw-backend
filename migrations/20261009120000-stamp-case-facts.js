import {
  caseRefs,
  seriesRefs,
} from "../src/cases/repositories/case/case-document.js";
import { logger } from "../src/common/logger.js";

// Gives every case the refs its writers now keep.
// Every write is an `$addToSet` or a `$set` of the same value, so it is safe to
// run over a row a writer has already stamped.

const BATCH_SIZE = 1000;

const primary = { readPreference: "primary" };

const toOwnRefsWrite = (doc) => ({
  updateOne: {
    filter: { _id: doc._id },
    update: { $addToSet: { refs: { $each: caseRefs(doc) } } },
  },
});

const stampOwnRefs = async (cases) => {
  const all = cases.find(
    {},
    {
      ...primary,
      projection: { caseRef: 1, "payload.identifiers.sbi": 1 },
      sort: { _id: 1 },
      batchSize: BATCH_SIZE,
    },
  );
  let stamped = 0;
  let writes = [];

  for await (const doc of all) {
    writes.push(toOwnRefsWrite(doc));

    if (writes.length === BATCH_SIZE) {
      await cases.bulkWrite(writes, { ordered: false });
      stamped += writes.length;
      writes = [];
    }
  }

  if (writes.length > 0) {
    await cases.bulkWrite(writes, { ordered: false });
  }

  return stamped + writes.length;
};

const linkSeries = (cases, { workflowCode, caseRefs: members }) =>
  cases.updateMany(
    { workflowCode, caseRef: { $in: members } },
    { $addToSet: { refs: { $each: seriesRefs(members) } } },
  );

const linkEverySeries = async (db, cases) => {
  const replacements = db
    .collection("case_series")
    .find({ "caseRefs.1": { $exists: true } }, primary);
  let linked = 0;

  for await (const series of replacements) {
    await linkSeries(cases, series);
    linked += 1;
  }

  return linked;
};

const assertNone = async (cases, filter, problem) => {
  const count = await cases.countDocuments(filter, primary);

  if (count > 0) {
    throw new Error(`${count} cases ${problem}`);
  }
};

export const up = async (db) => {
  const cases = db.collection("cases");

  const stamped = await stampOwnRefs(cases);
  const linked = await linkEverySeries(db, cases);

  logger.info(`Gave ${stamped} cases their refs and linked ${linked} series`);

  await assertNone(cases, { refs: null }, "were left without refs");
};
