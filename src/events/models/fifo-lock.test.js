import { describe, expect, it } from "vitest";
import { FifoLock } from "./fifo-lock.js";

describe("FifoLock model", () => {
  it("should create a FifoLock from props", () => {
    const now = new Date();
    const lock = new FifoLock({
      _id: "abc",
      locked: true,
      segregationRef: "ref-1",
      lockedAt: now,
      actor: "INBOX",
    });

    expect(lock._id).toBe("abc");
    expect(lock.locked).toBe(true);
    expect(lock.segregationRef).toBe("ref-1");
    expect(lock.lockedAt).toBe(now);
    expect(lock.actor).toBe("INBOX");
  });

  it("should convert to a document", () => {
    const now = new Date();
    const lock = new FifoLock({
      _id: "abc",
      locked: true,
      segregationRef: "ref-1",
      lockedAt: now,
      actor: "OUTBOX",
    });

    const doc = lock.toDocument();
    expect(doc).toEqual({
      _id: "abc",
      locked: true,
      segregationRef: "ref-1",
      lockedAt: now,
      actor: "OUTBOX",
    });
  });

  it("should create from a document", () => {
    const doc = {
      _id: "xyz",
      locked: 1,
      segregationRef: "ref-2",
      lockedAt: new Date(),
      actor: "INBOX",
    };

    const lock = FifoLock.fromDocument(doc);
    expect(lock).toBeInstanceOf(FifoLock);
    expect(lock._id).toBe("xyz");
    expect(lock.locked).toBe(true);
    expect(lock.segregationRef).toBe("ref-2");
  });

  it("should coerce falsy locked to false in fromDocument", () => {
    const doc = {
      _id: "xyz",
      locked: 0,
      segregationRef: "ref-2",
      lockedAt: null,
      actor: "INBOX",
    };

    const lock = FifoLock.fromDocument(doc);
    expect(lock.locked).toBe(false);
  });

  it("should create a mock", () => {
    const mock = FifoLock.createMock();
    expect(mock).toBeInstanceOf(FifoLock);
    expect(mock._id).toBe("1234");
    expect(mock.locked).toBe(true);
    expect(mock.actor).toBe("INBOX");
  });

  it("should create a mock with overrides", () => {
    const mock = FifoLock.createMock({ actor: "OUTBOX", locked: false });
    expect(mock.actor).toBe("OUTBOX");
    expect(mock.locked).toBe(false);
  });
});
