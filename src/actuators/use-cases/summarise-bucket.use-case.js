import { BUCKET_ID } from "../../common/buckets/bucket.js";
import { parseSummary, runSummary } from "../../common/buckets/summary.js";
import { refuse } from "../../common/buckets/refusal.js";
import { findBucket } from "../../common/buckets/registry.js";
import { logger } from "../../common/logger.js";

const bucketOf = (bucketId) => {
  const bucket = BUCKET_ID.test(bucketId) ? findBucket(bucketId) : undefined;

  if (!bucket) {
    throw refuse("UNKNOWN_BUCKET");
  }

  return bucket;
};

export const summariseBucketUseCase = async ({ bucketId, summaryId, body }) => {
  const bucket = bucketOf(bucketId);
  const query = parseSummary(bucket, summaryId, body);

  logger.info(`Summarise bucket ${bucket.id} (${summaryId})`);

  const result = await runSummary(bucket, query);

  logger.info(`Finished: Summarise bucket (${result.entries.length} entries)`);

  return result;
};
