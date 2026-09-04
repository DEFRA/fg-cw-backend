import { describe, expect, it } from "vitest";
import { boxCountsResponseSchema } from "./box-counts-response.schema.js";

const allStatuses = () => ({
  PUBLISHED: 1,
  PROCESSING: 2,
  FAILED: 3,
  RESUBMITTED: 4,
  COMPLETED: 5,
  DEAD_LETTER: 6,
});

const aResponse = (overrides = {}) => ({
  counts: allStatuses(),
  ...overrides,
});

describe("boxCountsResponseSchema", () => {
  it("accepts every status", () => {
    expect(boxCountsResponseSchema.validate(aResponse()).error).toBeUndefined();
  });

  it("accepts zeros", () => {
    const counts = Object.fromEntries(
      Object.keys(allStatuses()).map((key) => [key, 0]),
    );

    expect(
      boxCountsResponseSchema.validate(aResponse({ counts })).error,
    ).toBeUndefined();
  });

  it("requires every status, so a zero-fill gap fails a test", () => {
    const { DEAD_LETTER, ...counts } = allStatuses();

    expect(
      boxCountsResponseSchema.validate(aResponse({ counts })).error,
    ).toBeDefined();
  });

  it("rejects a status outside the known set", () => {
    expect(
      boxCountsResponseSchema.validate(
        aResponse({ counts: { ...allStatuses(), NONSENSE: 1 } }),
      ).error,
    ).toBeDefined();
  });

  it("rejects a negative or fractional count", () => {
    expect(
      boxCountsResponseSchema.validate(
        aResponse({ counts: { ...allStatuses(), FAILED: -1 } }),
      ).error,
    ).toBeDefined();
    expect(
      boxCountsResponseSchema.validate(
        aResponse({ counts: { ...allStatuses(), FAILED: 1.5 } }),
      ).error,
    ).toBeDefined();
  });

  it("requires the counts block", () => {
    expect(boxCountsResponseSchema.validate({}).error).toBeDefined();
  });

  // The TYPE facet is gone with the filter it described: `counts` alone IS the
  // whole answer, and a `byKind` block a caller offers is rejected rather than
  // silently carried.
  it("accepts counts alone as the whole answer", () => {
    expect(
      boxCountsResponseSchema.validate({ counts: allStatuses() }).error,
    ).toBeUndefined();
  });

  it("rejects a byKind block", () => {
    expect(
      boxCountsResponseSchema.validate(
        aResponse({ byKind: { domain: 1, audit: 2 } }),
      ).error,
    ).toBeDefined();
    expect(
      boxCountsResponseSchema.validate({ byKind: { domain: 1, audit: 2 } })
        .error,
    ).toBeDefined();
  });
});
