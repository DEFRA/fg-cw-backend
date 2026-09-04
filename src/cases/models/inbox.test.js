import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Inbox, InboxStatus } from "./inbox.js";

describe("inbox model", () => {
  it("creates an inbox model", () => {
    const messageId = randomUUID();
    const obj = new Inbox({
      event: { time: new Date().toISOString() },
      messageId,
      type: "io.onsite.some.value.or.another",
      source: "source-system",
      messageGroupId: "some-group-id",
      segregationRef: "some-segregation-ref",
    });

    expect(obj).toBeInstanceOf(Inbox);
  });

  it("should mark a document as complete", async () => {
    const messageId = randomUUID();
    const obj = Inbox.createMock({
      event: {
        data: {
          foo: "barr",
        },
      },
      messageId,
      type: "io.onsite.some.value.or.another",
    });

    obj.claimedBy = randomUUID();
    obj.claimedAt = new Date();
    obj.claimExpiresAt = new Date(Date.now() + 5000);

    obj.markAsComplete();
    expect(obj.status).toBe(InboxStatus.COMPLETED);
    expect(obj.claimedBy).toBeNull();
    expect(obj.claimedAt).toBeNull();
    expect(obj.claimExpiresAt).toBeNull();
    expect(obj.completionDate).toEqual(expect.any(String));
  });

  it("should mark a document as failed", async () => {
    const messageId = randomUUID();
    const obj = new Inbox({
      event: {
        data: {
          foo: "barr",
        },
      },
      messageId,
      type: "io.onsite.some.value.or.another",
      segregationRef: "134",
      source: "gas",
    });

    obj.claimedBy = randomUUID();
    obj.claimedAt = new Date();
    obj.claimExpiresAt = new Date(Date.now() + 5000);

    obj.markAsFailed();
    expect(obj.status).toBe(InboxStatus.FAILED);
    expect(obj.lastResubmissionDate).toEqual(expect.any(String));
    expect(obj.claimedBy).toBeNull();
    expect(obj.claimedAt).toBeNull();
    expect(obj.claimExpiresAt).toBeNull();
  });

  it("should convert to a document", () => {
    const messageId = randomUUID();
    const obj = new Inbox({
      event: {
        data: {
          foo: "barr",
        },
      },
      messageId,
      type: "io.onsite.some.value.or.another",
      source: "AS",
      segregationRef: "1234",
    });

    obj.claimedBy = randomUUID();
    obj.claimedAt = new Date();
    obj.claimExpiresAt = new Date(Date.now() + 5000);
    const doc = obj.toDocument();
    expect(doc.event).toBe(obj.event);
    expect(doc.publicationDate).toBe(obj.publicationDate);
    expect(doc.status).toBe(obj.status);
    expect(doc.messageId).toBe(obj.messageId);
  });

  it("should throw on invalid props", () => {
    expect(() => new Inbox({ event: null })).toThrow("Invalid Inbox");
  });

  it("should throw with all validation errors", () => {
    expect(() => new Inbox({})).toThrow(/source/);
  });

  it("should create model from doc", () => {
    const doc = {
      _id: "09909-popopo",
      claimExpiresAt: new Date("2025-10-27T13:46:58.876Z"),
      claimedAt: new Date("2025-10-27T13:46:53.876Z"),
      claimedBy: "9216e9d3-611d-41e3-bc60-a0793964e30c",
      completionAttempts: 1,
      completionDate: null,
      event: {
        data: {
          foo: "barr",
        },
        messageGroupId: "mgid",
      },
      lastResubmissionDate: null,
      messageId: "d2868709-7232-4f08-8375-d367901cdadf",
      publicationDate: "2025-10-27T13:46:53.876Z",
      status: "PUBLISHED",
      type: "io.onsite.some.value.or.another",
      segregationRef: "ppp",
      source: "AS",
    };

    const model = Inbox.fromDocument(doc);
    expect(model).toBeInstanceOf(Inbox);
    expect(model._id).toBe(doc._id);
  });
});

describe("inbox model lastError", () => {
  const inbox = (props = {}) =>
    new Inbox({
      event: { time: new Date().toISOString() },
      messageId: randomUUID(),
      type: "cloud.defra.local.fg-gas-backend.case.create.new",
      source: "GAS",
      segregationRef: "ref-1",
      ...props,
    });

  it("defaults lastError to null", () => {
    expect(inbox().lastError).toBeNull();
  });

  it("records the caught error's name and message on markAsFailed", () => {
    const obj = inbox();

    obj.markAsFailed(new TypeError("no handler found"));

    expect(obj.lastError).toEqual({
      name: "TypeError",
      message: "no handler found",
      at: expect.any(String),
    });
  });

  it("truncates a very long failure message to 1024 characters", () => {
    const obj = inbox();

    obj.markAsFailed(new Error("y".repeat(4000)));

    expect(obj.lastError.message).toHaveLength(1024);
  });

  it("keeps the previous lastError when markAsFailed is called with no error", () => {
    const obj = inbox({
      lastError: {
        name: "Error",
        message: "earlier",
        at: "2026-06-16T10:00:00.000Z",
      },
    });

    obj.markAsFailed();

    expect(obj.lastError.message).toEqual("earlier");
  });

  it("carries lastError through toDocument and fromDocument", () => {
    const lastError = {
      name: "ClaimExpired",
      message: "claim expired before completion",
      at: "2026-06-16T10:00:00.000Z",
    };

    const document = inbox({ lastError }).toDocument();

    expect(document.lastError).toEqual(lastError);
    expect(Inbox.fromDocument(document).lastError).toEqual(lastError);
  });

  it("reads a legacy document with no lastError as null", () => {
    const document = inbox().toDocument();
    delete document.lastError;

    expect(Inbox.fromDocument(document).lastError).toBeNull();
  });
});

describe("Inbox attemptHistory", () => {
  const failed = (times, error = new Error("boom")) => {
    const event = Inbox.createMock();

    for (let i = 0; i < times; i++) {
      event.markAsFailed(error);
    }

    return event;
  };

  it("starts empty on a new event", () => {
    expect(Inbox.createMock().attemptHistory).toEqual([]);
  });

  it("reads a row written before attempt history existed as empty", () => {
    const event = Inbox.fromDocument({
      ...Inbox.createMock().toDocument(),
      attemptHistory: undefined,
    });

    expect(event.attemptHistory).toEqual([]);
  });

  it("appends one entry per failure, oldest first", () => {
    const event = failed(1);

    expect(event.attemptHistory).toEqual([
      { at: expect.any(String), name: "Error", message: "boom" },
    ]);
  });

  it("keeps only the ten most recent entries", () => {
    const event = Inbox.createMock();

    for (let i = 0; i < 14; i++) {
      event.markAsFailed(new Error(`attempt-${i}`));
    }

    expect(event.attemptHistory).toHaveLength(10);
    expect(event.attemptHistory.at(0).message).toBe("attempt-4");
    expect(event.attemptHistory.at(-1).message).toBe("attempt-13");
  });

  it("truncates an entry's message to 512 characters", () => {
    const event = failed(1, new Error("x".repeat(2000)));

    expect(event.attemptHistory.at(-1).message).toHaveLength(512);
  });

  it("records the same reason as lastError", () => {
    const event = failed(1, new TypeError("kaput"));

    expect(event.attemptHistory.at(-1)).toMatchObject({
      name: "TypeError",
      message: "kaput",
    });
    expect(event.lastError).toMatchObject({
      name: "TypeError",
      message: "kaput",
    });
  });

  it("appends nothing when markAsFailed is called with no error", () => {
    const event = failed(2);

    event.markAsFailed();

    expect(event.attemptHistory).toHaveLength(2);
  });

  it("leaves the history intact on markAsComplete", () => {
    const event = failed(2);

    event.markAsComplete();

    expect(event.status).toBe(InboxStatus.COMPLETED);
    expect(event.attemptHistory).toHaveLength(2);
  });

  it("carries the history onto the document it writes", () => {
    const event = failed(1);

    expect(event.toDocument().attemptHistory).toEqual(event.attemptHistory);
  });

  it("reads a stored history back off a document", () => {
    const stored = [{ at: null, name: "ClaimExpired", message: "gone" }];
    const event = Inbox.fromDocument({
      ...Inbox.createMock().toDocument(),
      attemptHistory: stored,
    });

    expect(event.attemptHistory).toEqual(stored);
  });
});
