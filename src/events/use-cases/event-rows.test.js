import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { InboxEventRow, OutboxEventRow } from "./event-rows.js";

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

describe("event row mappers", () => {
  it("maps an inbox document to the actuator row", () => {
    expect(
      InboxEventRow.fromInbox({
        _id: new ObjectId(ID),
        messageId: "msg-1",
        type: "cloud.defra.prd.fg-gas-backend.case.create.new",
        source: "GAS",
        status: "FAILED",
        completionAttempts: 2,
        eventTime: new Date("2026-06-16T10:00:00.000Z"),
        lastResubmissionDate: "2026-06-16T10:05:00.000Z",
        completionDate: null,
        lastError: {
          name: "Error",
          message: "boom",
          at: "2026-06-16T10:05:00.000Z",
          stack: "SECRET",
        },
      }),
    ).toEqual({
      _id: ID,
      eventId: "msg-1",
      type: "cloud.defra.prd.fg-gas-backend.case.create.new",
      source: "GAS",
      status: "FAILED",
      completionAttempts: 2,
      createdAt: "2026-06-16T10:00:00.000Z",
      lastFailureAt: "2026-06-16T10:05:00.000Z",
      lastError: {
        name: "Error",
        message: "boom",
        at: "2026-06-16T10:05:00.000Z",
      },
      completedAt: null,
    });
  });

  it("maps an outbox document to the actuator row", () => {
    expect(
      OutboxEventRow.fromOutbox({
        _id: new ObjectId(ID),
        event: {
          id: "evt-1",
          type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
          audit: { details: "not in row" },
        },
        target:
          "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated",
        status: "PUBLISHED",
        completionAttempts: 1,
        publicationDate: new Date("2026-06-16T10:00:00.000Z"),
      }),
    ).toEqual({
      _id: ID,
      eventId: "evt-1",
      type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
      target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated",
      status: "PUBLISHED",
      completionAttempts: 1,
      createdAt: "2026-06-16T10:00:00.000Z",
      lastFailureAt: null,
      lastError: null,
      completedAt: null,
    });
  });
});
