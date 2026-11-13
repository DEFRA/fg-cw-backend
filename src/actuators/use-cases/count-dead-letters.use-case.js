import { countBins } from "../../common/buckets/bins.js";
import { COUNT_CAP } from "../../common/buckets/engine.js";
import { listBuckets } from "../../common/buckets/registry.js";
import { logger } from "../../common/logger.js";
import { DEAD_LETTER } from "../../events/event-redrive.js";

export const BIN_MS = 2 * 60 * 60 * 1000;

const isDeadLetterBucket = ({ facts }) =>
  Array.isArray(facts.status?.values) &&
  facts.status.values.some(({ value }) => value === DEAD_LETTER);

// The list each count opens, as the admin's URL spells its filter.
const listOf = (bucket) => ({
  path: bucket.path,
  query: { [bucket.facts.status.param]: DEAD_LETTER },
});

const countBucket =
  ({ from, to }) =>
  async (bucket) => ({
    id: bucket.id,
    list: listOf(bucket),
    bins: await countBins(bucket, {
      where: { status: DEAD_LETTER },
      from,
      to,
      binMs: BIN_MS,
    }),
  });

// Every type is counted, audit events too, as the lists count them.
export const countDeadLettersUseCase = async ({ from, to }) => {
  const buckets = listBuckets().filter(isDeadLetterBucket);

  logger.info(`Count dead letters (${buckets.length} buckets)`);

  const counted = await Promise.all(buckets.map(countBucket({ from, to })));

  logger.info("Finished: Count dead letters");

  return { from, to, countCap: COUNT_CAP, buckets: counted };
};
