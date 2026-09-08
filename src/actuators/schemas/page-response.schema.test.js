import { describe, expect, it } from "vitest";
import { pageResponseSchema } from "./page-response.schema.js";

const pagination = {
  startCursor: "IN",
  endCursor: "OUT",
  hasNextPage: false,
  hasPreviousPage: false,
};

const counts = {
  PUBLISHED: 1,
  PROCESSING: 0,
  FAILED: 0,
  RESUBMITTED: 0,
  COMPLETED: 2,
  DEAD_LETTER: 3,
};

const aRow = (overrides = {}) => ({
  _id: "665f1c2e9a1b2c3d4e5f6a7b",
  eventId: "evt-1",
  type: "case.status.updated",
  status: "DEAD_LETTER",
  completionAttempts: 5,
  maxAttempts: 5,
  createdAt: "2026-06-16T10:00:00.000Z",
  lastFailureAt: null,
  lastError: null,
  completedAt: null,
  ...overrides,
});

const aBox = (rowOverrides, overrides = {}) => ({
  events: [aRow(rowOverrides)],
  pagination,
  counts,
  breakdown: { groups: [] },
  ...overrides,
});

const aPage = (overrides = {}) => ({
  inbox: aBox({ source: "GAS" }),
  outbox: aBox({ target: "cw__sns__audit_fifo" }),
  sectionErrors: [],
  ...overrides,
});

describe("pageResponseSchema", () => {
  it("is labelled ActuatorPageResponse", () => {
    expect(pageResponseSchema.describe().flags.label).toBe(
      "ActuatorPageResponse",
    );
  });

  it("accepts both boxes answered in full", () => {
    expect(pageResponseSchema.validate(aPage()).error).toBeUndefined();
  });

  it("requires both boxes, so a caller never has to guess at a missing one", () => {
    expect(
      pageResponseSchema.validate({ inbox: aBox(), sectionErrors: [] }).error,
    ).toBeDefined();
  });

  it("keeps each box to its own row shape", () => {
    const swapped = aPage({
      inbox: aBox({ target: "cw__sns__audit_fifo" }),
    });

    expect(pageResponseSchema.validate(swapped).error).toBeDefined();
  });

  it.each(["counts", "breakdown"])(
    "allows a null %s, which is a section that could not be read",
    (section) => {
      const page = aPage({
        inbox: aBox({ source: "GAS" }, { [section]: null }),
      });

      expect(pageResponseSchema.validate(page).error).toBeUndefined();
    },
  );

  // No rows is a fact about the box; unread is a fact about the request.
  it("allows a null list, and its pagination with it", () => {
    const page = aPage({
      inbox: aBox({ source: "GAS" }, { events: null, pagination: null }),
    });

    expect(pageResponseSchema.validate(page).error).toBeUndefined();
  });

  it("requires every section to be stated, even as a null", () => {
    const { events, ...withoutEvents } = aBox({ source: "GAS" });

    expect(
      pageResponseSchema.validate(aPage({ inbox: withoutEvents })).error,
    ).toBeDefined();
    expect(events).toHaveLength(1);
  });

  it("names the box and the section of anything that failed", () => {
    const page = aPage({
      sectionErrors: [
        { box: "inbox", section: "counts", message: "read failed" },
      ],
    });

    expect(pageResponseSchema.validate(page).error).toBeUndefined();
  });

  it.each([
    ["a box it has never heard of", { box: "deadletter", section: "counts" }],
    ["a section it has never heard of", { box: "inbox", section: "journey" }],
  ])("refuses a section error naming %s", (_name, error) => {
    const page = aPage({
      sectionErrors: [{ ...error, message: "read failed" }],
    });

    expect(pageResponseSchema.validate(page).error).toBeDefined();
  });

  // Never absent, so a caller reads it without a guard.
  it("requires the section errors, empty on a page that lost nothing", () => {
    const { sectionErrors, ...withoutErrors } = aPage();

    expect(pageResponseSchema.validate(withoutErrors).error).toBeDefined();
    expect(sectionErrors).toEqual([]);
  });
});
