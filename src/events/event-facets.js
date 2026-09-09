import { toStatusCounts } from "./status-counts.js";

// One source's answer to the FACETED counts question. Faceted, not filtered:
// each filter-bar control must show its siblings' true numbers even while one
// of its own segments is selected, so every block is computed with its own
// filter left out and every other filter applied.
//
// This box answers only the STATUS block. The merge arithmetic - totals, the
// SERVICE block, zeros for a source that could not be read - is owned solely
// by fg-gas-backend, beside the only caller that merges.
export const toSourceFacets = (rows) => ({ counts: toStatusCounts(rows) });
