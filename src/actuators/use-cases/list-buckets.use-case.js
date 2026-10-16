import { describeBucket } from "../../common/buckets/catalogue.js";
import { listBuckets } from "../../common/buckets/registry.js";
import { logger } from "../../common/logger.js";

export const listBucketsUseCase = async () => {
  logger.info("List buckets");

  const buckets = await Promise.all(listBuckets().map(describeBucket));

  logger.info(`Finished: List buckets (${buckets.length} buckets)`);

  return { buckets };
};
