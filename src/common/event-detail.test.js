import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { toDetailDocument } from "./event-detail.js";

const objectId = new ObjectId("665f1c2e9a1b2c3d4e5f6a7b");

const aDoc = (overrides = {}) => ({
  _id: objectId,
  messageId: "msg-1",
  status: "DEAD_LETTER",
  completionAttempts: 5,
  eventTime: "2026-06-16T10:00:00.000Z",
  publicationDate: new Date("2026-06-16T10:00:01.000Z"),
  completionDate: null,
  event: {
    id: "evt-1",
    type: "cloud.defra.prd.fg-gas-backend.case.create.new",
    data: { clientRef: "REF-1", nested: { deep: true } },
  },
  ...overrides,
});

describe("toDetailDocument", () => {
  it("returns the full event payload verbatim", () => {
    const doc = aDoc();

    expect(toDetailDocument(doc, 5).event).toEqual(doc.event);
  });

  it("returns the payload's nested data untouched", () => {
    expect(toDetailDocument(aDoc(), 5).event.data).toEqual({
      clientRef: "REF-1",
      nested: { deep: true },
    });
  });

  it("never returns claimedBy", () => {
    const detail = toDetailDocument(aDoc({ claimedBy: "claim-token" }), 5);

    expect(detail).not.toHaveProperty("claimedBy");
  });

  it("keeps the other claim fields", () => {
    const detail = toDetailDocument(
      aDoc({ claimedAt: null, claimExpiresAt: null }),
      5,
    );

    expect(detail.claimedAt).toBeNull();
    expect(detail.claimExpiresAt).toBeNull();
  });

  it("renders _id as a hex string", () => {
    expect(toDetailDocument(aDoc(), 5)._id).toBe("665f1c2e9a1b2c3d4e5f6a7b");
  });

  it("converts top-level Date values to ISO strings", () => {
    expect(toDetailDocument(aDoc(), 5).publicationDate).toBe(
      "2026-06-16T10:00:01.000Z",
    );
  });

  it("leaves top-level ISO strings alone", () => {
    expect(toDetailDocument(aDoc(), 5).eventTime).toBe(
      "2026-06-16T10:00:00.000Z",
    );
  });

  it("leaves nulls as null", () => {
    expect(toDetailDocument(aDoc(), 5).completionDate).toBeNull();
  });

  it("stamps maxAttempts", () => {
    expect(toDetailDocument(aDoc(), 5).maxAttempts).toBe(5);
  });

  it("does not mutate the document it was given", () => {
    const doc = aDoc({ claimedBy: "claim-token" });

    toDetailDocument(doc, 5);

    expect(doc.claimedBy).toBe("claim-token");
    expect(doc._id).toBe(objectId);
  });

  it("carries unknown fields through", () => {
    expect(toDetailDocument(aDoc({ somethingNew: 1 }), 5).somethingNew).toBe(1);
  });
});

describe("toDetailDocument attemptHistory", () => {
  const anEntry = (message) => ({
    at: "2026-06-16T10:00:00.000Z",
    name: "TypeError",
    message,
  });

  it("is an empty array on a row written before attempt history existed", () => {
    expect(toDetailDocument(aDoc(), 5).attemptHistory).toEqual([]);
  });

  it("returns the stored history oldest first", () => {
    const attemptHistory = [anEntry("one"), anEntry("two")];

    expect(
      toDetailDocument(aDoc({ attemptHistory }), 5).attemptHistory,
    ).toEqual(attemptHistory);
  });

  it("rebuilds each entry from the three contract keys only", () => {
    const attemptHistory = [{ ...anEntry("one"), stack: "SECRET-STACK" }];

    const [entry] = toDetailDocument(
      aDoc({ attemptHistory }),
      5,
    ).attemptHistory;

    expect(Object.keys(entry)).toEqual(["at", "name", "message"]);
    expect(entry).not.toHaveProperty("stack");
  });

  it("tolerates a malformed stored history", () => {
    expect(
      toDetailDocument(aDoc({ attemptHistory: "nope" }), 5).attemptHistory,
    ).toEqual([]);
    expect(
      toDetailDocument(aDoc({ attemptHistory: [{}] }), 5).attemptHistory,
    ).toEqual([{ at: null, name: "Error", message: "" }]);
  });

  it("serialises a Date `at` and caps a history past ten entries", () => {
    const attemptHistory = Array.from({ length: 14 }, (_, i) => ({
      at: new Date("2026-06-16T10:00:00.000Z"),
      name: "Error",
      message: `${i}`,
    }));

    const history = toDetailDocument(
      aDoc({ attemptHistory }),
      5,
    ).attemptHistory;

    expect(history).toHaveLength(10);
    expect(history.at(0)).toEqual({
      at: "2026-06-16T10:00:00.000Z",
      name: "Error",
      message: "4",
    });
  });
});
