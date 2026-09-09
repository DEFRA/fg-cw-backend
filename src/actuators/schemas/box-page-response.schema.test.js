import { describe, expect, it } from "vitest";
import { inboxRowSchema, outboxRowSchema } from "./box-page-response.schema.js";

const inboxRow = (overrides = {}) => ({
  _id: "665f1c2e9a1b2c3d4e5f6a7b",
  eventId: "3f2c1a0e",
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  status: "DEAD_LETTER",
  completionAttempts: 5,
  maxAttempts: 5,
  createdAt: "2026-06-16T10:00:00.000Z",
  lastFailureAt: "2026-06-16T10:16:05.000Z",
  lastError: {
    name: "ClaimExpired",
    message: "claim expired before completion",
    at: "2026-06-16T10:16:05.000Z",
  },
  completedAt: null,
  ...overrides,
});

const outboxRow = (overrides = {}) => ({
  _id: "665f1c2e9a1b2c3d4e5f6a7c",
  eventId: "9b4d2f10",
  type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
  target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated",
  status: "COMPLETED",
  completionAttempts: 1,
  maxAttempts: 5,
  createdAt: "2026-06-16T10:00:01.000Z",
  lastFailureAt: null,
  lastError: null,
  completedAt: "2026-06-16T10:00:02.000Z",
  ...overrides,
});

const validateInbox = (row) => inboxRowSchema.validate(row);

const validateOutbox = (row) => outboxRowSchema.validate(row);

describe("box row lastError", () => {
  const validateInbox = (lastError) =>
    inboxRowSchema.validate(inboxRow({ lastError }));

  it("accepts a null lastError on both boxes", () => {
    expect(validateInbox(null).error).toBeUndefined();
    expect(
      outboxRowSchema.validate(outboxRow({ lastError: null })).error,
    ).toBeUndefined();
  });

  it("accepts a lastError with a null at", () => {
    expect(
      validateInbox({ name: "Error", message: "boom", at: null }).error,
    ).toBeUndefined();
  });

  it("accepts an empty message", () => {
    expect(
      validateInbox({
        name: "Error",
        message: "",
        at: "2026-06-16T10:16:05.000Z",
      }).error,
    ).toBeUndefined();
  });

  it("rejects a lastError missing its name", () => {
    expect(
      validateInbox({ message: "boom", at: "2026-06-16T10:16:05.000Z" }).error,
    ).toBeDefined();
  });

  it("rejects an extra key such as a stack", () => {
    expect(
      validateInbox({
        name: "Error",
        message: "boom",
        at: "2026-06-16T10:16:05.000Z",
        stack: "SECRET",
      }).error,
    ).toBeDefined();
  });

  it("rejects a row with no lastError key at all", () => {
    const { lastError, ...withoutLastError } = inboxRow();

    expect(inboxRowSchema.validate(withoutLastError).error).toBeDefined();
  });
});

// These four fields live on the detail row only - a list row offering any of
// them is a regression, not a richer response.
describe("box row list trim", () => {
  it("rejects a row carrying fullType", () => {
    expect(validateInbox(inboxRow({ fullType: "x" })).error).toBeDefined();
    expect(validateOutbox(outboxRow({ fullType: "x" })).error).toBeDefined();
  });

  it("rejects a row carrying traceparent", () => {
    expect(
      validateInbox(
        inboxRow({
          traceparent:
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        }),
      ).error,
    ).toBeDefined();
    expect(
      validateOutbox(outboxRow({ traceparent: null })).error,
    ).toBeDefined();
  });

  it("rejects a row carrying segregationRef", () => {
    expect(
      validateInbox(inboxRow({ segregationRef: "GLD-9B2" })).error,
    ).toBeDefined();
    expect(
      validateOutbox(outboxRow({ segregationRef: "GLD-9B2" })).error,
    ).toBeDefined();
  });

  it("rejects a row carrying lastRedrive", () => {
    expect(
      validateInbox(
        inboxRow({
          lastRedrive: { at: "2026-06-16T11:05:00.000Z", by: null },
        }),
      ).error,
    ).toBeDefined();
    expect(
      validateOutbox(outboxRow({ lastRedrive: null })).error,
    ).toBeDefined();
  });
});
