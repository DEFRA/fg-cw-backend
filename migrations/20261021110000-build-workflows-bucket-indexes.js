import { workflowsBucket } from "../src/cases/buckets/workflows.bucket.js";
import { ensureIndexes } from "../src/common/buckets/indexes.js";

// Built after receivedAt is normalised, so that does not maintain them.
export const up = async (db) => {
  await ensureIndexes(db, workflowsBucket());
};
