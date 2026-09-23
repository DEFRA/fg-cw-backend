import { describe, expect, it } from "vitest";
import { pageResponseSchema } from "./page-response.schema.js";

const pagination = {
  hasNextPage: false,
};

const counts = {
  PUBLISHED: 1,
  PROCESSING: 0,
  FAILED: 0,
  RESUBMITTED: 0,
  COMPLETED: 2,
  DEAD_LETTER: 3,
  PURGED: 0,
};

const aRow = (overrides = {}) => ({
  _id: "665f1c2e9a1b2c3d4e5f6a7b",
  eventId: "evt-1",
  type: "case.status.updated",
  status: "DEAD_LETTER",
  publicationDate: "2026-06-16T10:00:00.000Z",
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
  inbox: aBox({}),
  outbox: aBox({}),
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
    expect(pageResponseSchema.validate({ inbox: aBox() }).error).toBeDefined();
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
        inbox: aBox({}, { [section]: null }),
      });

      expect(pageResponseSchema.validate(page).error).toBeUndefined();
    },
  );

  it("allows a null list, and its pagination with it", () => {
    const page = aPage({
      inbox: aBox({}, { events: null, pagination: null }),
    });

    expect(pageResponseSchema.validate(page).error).toBeUndefined();
  });

  it("requires every section to be stated, even as a null", () => {
    const { events, ...withoutEvents } = aBox({});

    expect(
      pageResponseSchema.validate(aPage({ inbox: withoutEvents })).error,
    ).toBeDefined();
    expect(events).toHaveLength(1);
  });
});
