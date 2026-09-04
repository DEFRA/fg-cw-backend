import { describe, expect, it } from "vitest";
import { boxBreakdownResponseSchema } from "./box-breakdown-response.schema.js";

const aGroup = (overrides = {}) => ({
  error: "No handler found for event type",
  type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
  count: 7,
  firstAt: "2026-06-16T10:00:00.000Z",
  lastAt: "2026-06-16T11:00:00.000Z",
  ...overrides,
});

const validate = (groups) => boxBreakdownResponseSchema.validate({ groups });

describe("boxBreakdownResponseSchema", () => {
  it("accepts a group", () => {
    expect(validate([aGroup()]).error).toBeUndefined();
  });

  it("accepts no groups at all", () => {
    expect(validate([]).error).toBeUndefined();
  });

  it("accepts a null error - a row can die before any error is recorded", () => {
    expect(validate([aGroup({ error: null })]).error).toBeUndefined();
  });

  it("accepts a null type - an audit outbox row stores none", () => {
    expect(validate([aGroup({ type: null })]).error).toBeUndefined();
  });

  it("accepts null timestamps", () => {
    expect(
      validate([aGroup({ firstAt: null, lastAt: null })]).error,
    ).toBeUndefined();
  });

  it("requires every key, so a mapping gap fails a test", () => {
    const { count, ...group } = aGroup();

    expect(validate([group]).error).toBeDefined();
  });

  it("rejects a negative count", () => {
    expect(validate([aGroup({ count: -1 })]).error).toBeDefined();
  });
});
