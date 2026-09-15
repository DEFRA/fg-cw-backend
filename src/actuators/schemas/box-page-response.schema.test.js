import { describe, expect, it } from "vitest";
import { inboxRowSchema, outboxRowSchema } from "./box-page-response.schema.js";

const aRow = (overrides = {}) => ({
  _id: "665f1c2e9a1b2c3d4e5f6a7b",
  eventId: "3f2c1a0e",
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  status: "DEAD_LETTER",
  publicationDate: "2026-06-16T10:00:00.000Z",
  completedAt: null,
  ...overrides,
});

describe.each([
  ["inbox", inboxRowSchema],
  ["outbox", outboxRowSchema],
])("%s row schema", (_box, schema) => {
  it("accepts a list row", () => {
    expect(schema.validate(aRow()).error).toBeUndefined();
  });

  it("accepts nulls where a row may have no value", () => {
    expect(
      schema.validate(
        aRow({ eventId: null, publicationDate: null, completedAt: null }),
      ).error,
    ).toBeUndefined();
  });

  it.each([
    "_id",
    "eventId",
    "type",
    "status",
    "publicationDate",
    "completedAt",
  ])("requires %s", (field) => {
    const { [field]: _omitted, ...row } = aRow();

    expect(schema.validate(row).error).toBeDefined();
  });

  it("refuses a key it does not declare", () => {
    expect(schema.validate(aRow({ someUnknownKey: "x" })).error).toBeDefined();
  });
});
