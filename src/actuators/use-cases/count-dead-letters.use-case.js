import { countBins } from "../../common/buckets/bins.js";
import { COUNT_CAP, parseRange } from "../../common/buckets/engine.js";
import { refuse } from "../../common/buckets/refusal.js";
import { listBuckets } from "../../common/buckets/registry.js";
import { logger } from "../../common/logger.js";

const BIN_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

// A week of two-hour bins at most, so one read stays bounded.
const MAX_WINDOW_MS = DAYS_PER_WEEK * DAY_MS;

const parseWindow = (window) => {
  const { from, to } = parseRange(window);

  if (Date.parse(to) - Date.parse(from) > MAX_WINDOW_MS) {
    throw refuse("INVALID_REQUEST");
  }

  return { from, to };
};

// The list each count opens, as the admin's URL spells its filter.
const listOf = ({ path, facts, bins }) => ({
  path,
  query: Object.fromEntries(
    Object.entries(bins.among).map(([fact, value]) => [
      facts[fact].param,
      value,
    ]),
  ),
});

const countBucket =
  ({ from, to }) =>
  async (bucket) => ({
    id: bucket.id,
    list: listOf(bucket),
    bins: await countBins(bucket, {
      where: bucket.bins.among,
      from,
      to,
      binMs: BIN_MS,
    }),
  });

// Every bucket that declares bins of its dead letters; every type is counted,
// audit events too, as the lists count them.
export const countDeadLettersUseCase = async (window) => {
  const { from, to } = parseWindow(window);
  const buckets = listBuckets().filter(({ bins }) => bins !== null);

  logger.info(`Count dead letters (${buckets.length} buckets)`);

  const counted = await Promise.all(buckets.map(countBucket({ from, to })));

  logger.info("Finished: Count dead letters");

  return { from, to, countCap: COUNT_CAP, buckets: counted };
};
