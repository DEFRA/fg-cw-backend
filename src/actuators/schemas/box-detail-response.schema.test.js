import { describe, expect, it } from "vitest";
import {
  inboxDetailResponseSchema,
  outboxDetailResponseSchema,
} from "./box-detail-response.schema.js";

const aDetail = (overrides = {}) => ({
  _id: "665f1c2e9a1b2c3d4e5f6a7b",
  status: "DEAD_LETTER",
  completionAttempts: 5,
  maxAttempts: 5,
  segregationRef: "GLD-9B2",
  event: { id: "evt-1", data: { clientRef: "REF-1" } },
  lastError: { name: "TypeError", message: "boom", at: null },
  lastResubmissionDate: null,
  completionDate: null,
  publicationDate: "2026-06-16T10:00:00.000Z",
  claimedAt: null,
  claimExpiresAt: null,
  attemptHistory: [],
  ...overrides,
});

const anInbox = (overrides = {}) =>
  aDetail({
    messageId: "msg-1",
    type: "cloud.defra.prd.fg-gas-backend.case.create.new",
    source: "GAS",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    eventTime: "2026-06-16T10:00:00.000Z",
    ...overrides,
  });

const anOutbox = (overrides = {}) =>
  aDetail({
    target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__create_case.fifo",
    ...overrides,
  });

describe("inboxDetailResponseSchema", () => {
  it("is labelled InboxEventDetail", () => {
    expect(inboxDetailResponseSchema.describe().flags.label).toBe(
      "InboxEventDetail",
    );
  });

  it("accepts a whole inbox document", () => {
    expect(inboxDetailResponseSchema.validate(anInbox()).error).toBeUndefined();
  });

  it("accepts an arbitrary event payload", () => {
    const event = { anything: { at: "all" }, list: [1, 2, 3] };

    expect(
      inboxDetailResponseSchema.validate(anInbox({ event })).error,
    ).toBeUndefined();
  });

  it("requires the event payload key", () => {
    const { event, ...withoutEvent } = anInbox();

    expect(
      inboxDetailResponseSchema.validate(withoutEvent).error,
    ).toBeDefined();
  });

  it("rejects a claimedBy, so a claim token can never be returned", () => {
    const { error } = inboxDetailResponseSchema.validate(
      anInbox({ claimedBy: "claim-token" }),
    );

    expect(error).toBeDefined();
    expect(error.message).toContain("claimedBy");
  });

  it("tolerates unknown fields from another service version", () => {
    expect(
      inboxDetailResponseSchema.validate(anInbox({ somethingNew: 1 })).error,
    ).toBeUndefined();
  });

  it("requires maxAttempts", () => {
    const { maxAttempts, ...without } = anInbox();

    expect(inboxDetailResponseSchema.validate(without).error).toBeDefined();
  });
});

describe("outboxDetailResponseSchema", () => {
  it("is labelled OutboxEventDetail", () => {
    expect(outboxDetailResponseSchema.describe().flags.label).toBe(
      "OutboxEventDetail",
    );
  });

  it("accepts a whole outbox document", () => {
    expect(
      outboxDetailResponseSchema.validate(anOutbox()).error,
    ).toBeUndefined();
  });

  it("accepts the full target ARN", () => {
    const { value } = outboxDetailResponseSchema.validate(anOutbox());

    expect(value.target).toBe(
      "arn:aws:sns:eu-west-2:000000000000:cw__sns__create_case.fifo",
    );
  });

  it("rejects a claimedBy", () => {
    expect(
      outboxDetailResponseSchema.validate(anOutbox({ claimedBy: "t" })).error,
    ).toBeDefined();
  });
});

describe("detail attemptHistory", () => {
  const anEntry = {
    at: "2026-06-16T10:00:00.000Z",
    name: "ClaimExpired",
    message: "claim expired before completion",
  };

  it("accepts an empty history on both boxes", () => {
    expect(
      inboxDetailResponseSchema.validate(anInbox({ attemptHistory: [] })).error,
    ).toBeUndefined();
    expect(
      outboxDetailResponseSchema.validate(anOutbox({ attemptHistory: [] }))
        .error,
    ).toBeUndefined();
  });

  it("accepts a history of entries", () => {
    expect(
      inboxDetailResponseSchema.validate(
        anInbox({ attemptHistory: [anEntry, { ...anEntry, at: null }] }),
      ).error,
    ).toBeUndefined();
  });

  it("requires the key, so a mapping gap fails a test rather than a render", () => {
    const { attemptHistory, ...without } = anInbox();

    expect(inboxDetailResponseSchema.validate(without).error).toBeDefined();
  });

  it("rejects null, an entry missing a name and a non-array", () => {
    expect(
      inboxDetailResponseSchema.validate(anInbox({ attemptHistory: null }))
        .error,
    ).toBeDefined();
    expect(
      inboxDetailResponseSchema.validate(
        anInbox({ attemptHistory: [{ at: null, message: "x" }] }),
      ).error,
    ).toBeDefined();
    expect(
      inboxDetailResponseSchema.validate(anInbox({ attemptHistory: {} })).error,
    ).toBeDefined();
  });

  it("allows an empty message, as lastError does", () => {
    expect(
      inboxDetailResponseSchema.validate(
        anInbox({ attemptHistory: [{ ...anEntry, message: "" }] }),
      ).error,
    ).toBeUndefined();
  });
});
