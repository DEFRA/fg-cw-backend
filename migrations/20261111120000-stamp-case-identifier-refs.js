import { caseRefs } from "../src/cases/repositories/case/case-document.js";
import { logger } from "../src/common/logger.js";

// Gives every case the FRN and CRN refs its writers now keep beside the SBI.
// Every write is an `$addToSet`, so it is safe to run over a case a writer has
// already stamped.

const BATCH_SIZE = 1000;

const primary = { readPreference: "primary" };

const toRefsWrite = (doc) => ({
  updateOne: {
    filter: { _id: doc._id },
    update: { $addToSet: { refs: { $each: caseRefs(doc) } } },
  },
});

export const up = async (db) => {
  const cases = db.collection("cases");
  const all = cases.find(
    {},
    {
      ...primary,
      projection: { caseRef: 1, "payload.identifiers": 1 },
      sort: { _id: 1 },
      batchSize: BATCH_SIZE,
    },
  );
  let stamped = 0;
  let writes = [];

  for await (const doc of all) {
    writes.push(toRefsWrite(doc));

    if (writes.length === BATCH_SIZE) {
      await cases.bulkWrite(writes, { ordered: false });
      stamped += writes.length;
      writes = [];
    }
  }

  if (writes.length > 0) {
    await cases.bulkWrite(writes, { ordered: false });
  }

  logger.info(`Gave ${stamped + writes.length} cases their FRN and CRN refs`);
};
