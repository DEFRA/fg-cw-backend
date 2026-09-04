import { EVENT_STATUSES, toStatusCounts, zeroCounts } from "./status-counts.js";

// One source's answer to the FACETED counts question, and the arithmetic that
// gets there.
//
// Faceted, not filtered: the filter bar renders two segmented controls
// (STATUS / SERVICE) and each one must show its siblings' true numbers even
// while one of its own segments is selected. So every block is computed with
// its own filter left out and every other filter applied - standard
// faceted-search semantics.
//
// The STATUS block is the part one box can answer on its own: a `$match` on
// everything else the operator asked for, grouped by status. The SERVICE block
// is merged from the per-source totals in fg-gas-backend, which fans out to
// both services.

// How many rows sit behind one set of status counts. A source that answered
// nothing counts as zero, so the totals stay renderable alongside a
// `sourceError`.
export const totalOf = (counts) =>
  EVENT_STATUSES.reduce((total, status) => total + (counts?.[status] ?? 0), 0);

// What one source contributes to the faceted answer.
export const toSourceFacets = (rows) => ({ counts: toStatusCounts(rows) });

// A source that could not be read at all: zeros in every block, so the numbers
// stay renderable next to its `sourceError`.
export const zeroFacets = () => ({ counts: zeroCounts() });
