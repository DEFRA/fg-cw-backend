import { casesBucket } from "../src/cases/buckets/cases.bucket.js";
import { ensureIndexes } from "../src/common/buckets/indexes.js";

// Builds the Cases list's workflow and version line. The bucket's other keys
// exist already and are kept.
export const up = async (db) => {
  await ensureIndexes(db, casesBucket());
};
