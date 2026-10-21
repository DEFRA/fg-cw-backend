import { describe, expect, it } from "vitest";
import {
  bucketCatalogueResponseSchema,
  bucketQueryRequestSchema,
  bucketQueryResponseSchema,
} from "./bucket.schema.js";

const entry = {
  id: "cw.example",
  path: "cw/example",
  label: "Example",
  service: "CW",
  shortLabel: "Example",
  icon: null,
  order: 80,
  noun: { one: "example", many: "examples" },
  time: { label: "Created" },
  facts: [],
  refs: [],
  indexes: [[]],
  groupings: [],
  title: { label: "Reference", format: "mono" },
  columns: [],
  audited: true,
  timeline: false,
  summaries: [],
  page: null,
  tab: null,
};

describe("bucket schemas", () => {
  it("names the engine's schemas for the API documentation", () => {
    expect(bucketQueryRequestSchema.describe().flags.label).toBe(
      "BucketQueryRequest",
    );
    expect(bucketQueryResponseSchema.describe().flags.label).toBe(
      "BucketQueryResponse",
    );
  });

  it("reads no body as the empty query", () => {
    expect(bucketQueryRequestSchema.validate(null).value).toEqual({
      where: {},
      show: [],
      limit: 20,
      groupBy: [],
    });
  });

  it("accepts a catalogue of this service's entries", () => {
    expect(
      bucketCatalogueResponseSchema.validate({ buckets: [entry] }).error,
    ).toBeUndefined();
  });

  it("refuses a catalogue without buckets", () => {
    expect(bucketCatalogueResponseSchema.validate({}).error).toBeDefined();
  });

  it("refuses a catalogue entry that lacks a key the caller reads", () => {
    const { groupings: _, ...incomplete } = entry;

    expect(
      bucketCatalogueResponseSchema.validate({ buckets: [incomplete] }).error,
    ).toBeDefined();
  });
});
