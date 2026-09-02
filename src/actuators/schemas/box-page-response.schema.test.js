import { describe, expect, it } from "vitest";
import {
  inboxPageResponseSchema,
  outboxPageResponseSchema,
} from "./box-page-response.schema.js";

const pagination = {
  startCursor: "eyJhIjoxfQ",
  endCursor: "eyJhIjoyfQ",
  hasNextPage: true,
  hasPreviousPage: false,
};

const inboxRow = (overrides = {}) => ({
  _id: "665f1c2e9a1b2c3d4e5f6a7b",
  eventId: "3f2c1a0e",
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  segregationRef: "GLD-9B2-BWS-grasslands",
  status: "DEAD_LETTER",
  completionAttempts: 5,
  maxAttempts: 5,
  traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  createdAt: "2026-06-16T10:00:00.000Z",
  lastFailureAt: "2026-06-16T10:16:05.000Z",
  completedAt: null,
  ...overrides,
});

const outboxRow = (overrides = {}) => ({
  _id: "665f1c2e9a1b2c3d4e5f6a7c",
  eventId: "9b4d2f10",
  type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
  auditEntities: null,
  target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated",
  segregationRef: "GLD-9B2-BWS-grasslands",
  status: "COMPLETED",
  completionAttempts: 1,
  maxAttempts: 5,
  traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  createdAt: "2026-06-16T10:00:01.000Z",
  lastFailureAt: null,
  completedAt: "2026-06-16T10:00:02.000Z",
  ...overrides,
});

const validateInbox = (row) =>
  inboxPageResponseSchema.validate({ data: [row], pagination });

const validateOutbox = (row) =>
  outboxPageResponseSchema.validate({ data: [row], pagination });

describe("inboxPageResponseSchema", () => {
  it("accepts a full inbox row", () => {
    expect(validateInbox(inboxRow()).error).toBeUndefined();
  });

  it("accepts an empty page with null cursors", () => {
    const { error } = inboxPageResponseSchema.validate({
      data: [],
      pagination: { ...pagination, startCursor: null, endCursor: null },
    });

    expect(error).toBeUndefined();
  });

  it("accepts nulls for every optional timestamp", () => {
    const { error } = validateInbox(
      inboxRow({ lastFailureAt: null, completedAt: null, createdAt: null }),
    );

    expect(error).toBeUndefined();
  });

  it("requires maxAttempts on every row", () => {
    const { maxAttempts, ...row } = inboxRow();

    expect(maxAttempts).toBe(5);
    expect(validateInbox(row).error).toBeDefined();
  });

  it("rejects a non-integer maxAttempts", () => {
    expect(validateInbox(inboxRow({ maxAttempts: 2.5 })).error).toBeDefined();
  });

  it("accepts a status outside the six values", () => {
    expect(validateInbox(inboxRow({ status: "WEIRD" })).error).toBeUndefined();
  });

  it("rejects a row carrying an event object", () => {
    const { error } = validateInbox(inboxRow({ event: { data: {} } }));

    expect(error).toBeDefined();
  });

  it("requires traceparent on every row", () => {
    const { traceparent, ...row } = inboxRow();

    expect(traceparent).toBeDefined();
    expect(validateInbox(row).error).toBeDefined();
  });

  it("accepts a null traceparent", () => {
    expect(
      validateInbox(inboxRow({ traceparent: null })).error,
    ).toBeUndefined();
  });

  it("accepts a bare CDP request id as traceparent", () => {
    expect(
      validateInbox(inboxRow({ traceparent: "cdp-request-id-1" })).error,
    ).toBeUndefined();
  });

  it("rejects a row carrying a kind key", () => {
    expect(validateInbox(inboxRow({ kind: "audit" })).error).toBeDefined();
  });

  it("rejects a row carrying claimedBy", () => {
    expect(
      validateInbox(inboxRow({ claimedBy: "worker" })).error,
    ).toBeDefined();
  });

  it("rejects a totalCount in pagination", () => {
    const { error } = inboxPageResponseSchema.validate({
      data: [],
      pagination: { ...pagination, totalCount: 3 },
    });

    expect(error).toBeDefined();
  });
});

describe("outboxPageResponseSchema", () => {
  it("accepts a full outbox CloudEvent row", () => {
    expect(validateOutbox(outboxRow()).error).toBeUndefined();
  });

  it("accepts an audit outbox row with null eventId and type", () => {
    const { error } = validateOutbox(
      outboxRow({
        eventId: null,
        type: null,
        auditEntities: [{ entity: "CASE", action: "VIEW_CASE_LIST" }],
      }),
    );

    expect(error).toBeUndefined();
  });

  it("rejects an audit entity carrying entityid", () => {
    const { error } = validateOutbox(
      outboxRow({
        auditEntities: [
          { entity: "CASE", action: "CREATE_CASE", entityid: "APP-REF-1" },
        ],
      }),
    );

    expect(error).toBeDefined();
  });

  it("accepts an empty auditEntities array", () => {
    expect(
      validateOutbox(outboxRow({ auditEntities: [] })).error,
    ).toBeUndefined();
  });

  it("accepts a null auditEntities", () => {
    expect(
      validateOutbox(outboxRow({ auditEntities: null })).error,
    ).toBeUndefined();
  });

  it("requires auditEntities to be present", () => {
    const { auditEntities, ...row } = outboxRow();

    expect(auditEntities).toBeNull();
    expect(validateOutbox(row).error).toBeDefined();
  });

  it("requires maxAttempts on every row", () => {
    const { maxAttempts, ...row } = outboxRow();

    expect(maxAttempts).toBe(5);
    expect(validateOutbox(row).error).toBeDefined();
  });

  it("accepts a status outside the six values", () => {
    expect(
      validateOutbox(outboxRow({ status: "WEIRD" })).error,
    ).toBeUndefined();
  });

  it("rejects a row carrying an event object", () => {
    expect(validateOutbox(outboxRow({ event: {} })).error).toBeDefined();
  });

  it("requires traceparent on every row", () => {
    const { traceparent, ...row } = outboxRow();

    expect(traceparent).toBeDefined();
    expect(validateOutbox(row).error).toBeDefined();
  });

  it("accepts a null traceparent for an audit row", () => {
    const { error } = validateOutbox(
      outboxRow({
        eventId: null,
        type: null,
        traceparent: null,
        auditEntities: [{ entity: "CASE", action: "VIEW_CASE_LIST" }],
      }),
    );

    expect(error).toBeUndefined();
  });

  it("rejects a row carrying a correlationid", () => {
    expect(
      validateOutbox(outboxRow({ correlationid: "abc" })).error,
    ).toBeDefined();
  });

  it("rejects a row carrying a kind key", () => {
    expect(validateOutbox(outboxRow({ kind: "audit" })).error).toBeDefined();
  });

  it("accepts the raw SNS ARN in target", () => {
    expect(validateOutbox(outboxRow()).value.data[0].target).toBe(
      "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated",
    );
  });
});
