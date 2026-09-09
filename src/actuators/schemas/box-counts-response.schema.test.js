import { describe, expect, it } from "vitest";
import { countsSchema } from "./box-counts-response.schema.js";

// The per-status block itself. It used to be wrapped in a response schema of
// its own, for a standalone counts endpoint that the page composite replaced;
// what the composite carries, and what these pin, is the block.

const allStatuses = () => ({
  PUBLISHED: 1,
  PROCESSING: 2,
  FAILED: 3,
  RESUBMITTED: 4,
  COMPLETED: 5,
  DEAD_LETTER: 6,
});

const validate = (counts) => countsSchema.validate(counts).error;

describe("countsSchema", () => {
  it("accepts every status", () => {
    expect(validate(allStatuses())).toBeUndefined();
  });

  // A bucket that vanished when it emptied could not be told from a bucket
  // the answer forgot.
  it("accepts zeros", () => {
    const counts = Object.fromEntries(
      Object.keys(allStatuses()).map((key) => [key, 0]),
    );

    expect(validate(counts)).toBeUndefined();
  });

  it("requires every status, so a zero-fill gap fails a test", () => {
    const { DEAD_LETTER, ...counts } = allStatuses();

    expect(validate(counts)).toBeDefined();
    expect(DEAD_LETTER).toBe(6);
  });

  it("rejects a status outside the known set", () => {
    expect(validate({ ...allStatuses(), NONSENSE: 1 })).toBeDefined();
  });

  it.each([
    ["a negative count", -1],
    ["a fractional count", 1.5],
  ])("rejects %s", (_name, value) => {
    expect(validate({ ...allStatuses(), FAILED: value })).toBeDefined();
  });

  // The kind split was a shape an earlier draft carried; nothing answers with
  // it, and a schema that tolerated it would let one back in unnoticed.
  it("rejects a byKind block", () => {
    expect(
      validate({ ...allStatuses(), byKind: { domain: 1, audit: 2 } }),
    ).toBeDefined();
  });
});
