// TRADEOFF - an unfiltered count is a full collection scan (`$group` visits
// every matched document), accepted deliberately: this is an ops tool called
// once per page render, and a maintained counters collection would put write
// amplification on the hot claim/publish path to save a read nobody waits on.
export const EVENT_STATUSES = [
  "PUBLISHED",
  "PROCESSING",
  "FAILED",
  "RESUBMITTED",
  "COMPLETED",
  "DEAD_LETTER",
];

// Every key always present: the frontend renders one number per status, and a
// missing key would render as a blank rather than a zero.
export const zeroCounts = () =>
  Object.fromEntries(EVENT_STATUSES.map((status) => [status, 0]));

const isKnownStatus = (counts, row) => Boolean(row) && row._id in counts;

// `$group` only emits the statuses that actually occur, and a rogue document
// can carry a status outside the known set - counted into nothing rather than
// widening the response shape.
export const toStatusCounts = (rows) => {
  const counts = zeroCounts();

  for (const row of rows ?? []) {
    if (isKnownStatus(counts, row)) {
      counts[row._id] += row.count;
    }
  }

  return counts;
};

export const statusGroupStage = () => ({
  $group: { _id: "$status", count: { $sum: 1 } },
});
