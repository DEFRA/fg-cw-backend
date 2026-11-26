import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../common/config.js";
import {
  OTHER,
  PURGED,
  PURGE_NOTE_MAX_LENGTH,
  PURGE_REASON_CODES,
  purgeConflict,
  purgeUpdate,
} from "./event-purge.js";
import {
  DEAD_LETTER,
  REDRIVABLE_STATUSES,
  redriveConflict,
} from "./event-redrive.js";
import { appendAction } from "./event-history.js";

const ID = "665f1c2e9a1b2c3d4e5f6a7b";
const NOW = new Date("2026-06-16T10:00:00.000Z");
const RETENTION_DAYS = config.get("events.retentionDays");
const DAY_MS = 86_400_000;

const aPurge = (overrides = {}) => ({
  by: "ada",
  reasonCode: "BROKEN_PAYLOAD",
  note: "the payload has no caseRef",
  ...overrides,
});

describe("purge reason codes", () => {
  it("is the fixed set the admin offers, with OTHER last", () => {
    expect(PURGE_REASON_CODES).toEqual([
      "BROKEN_PAYLOAD",
      "SENT_IN_ERROR",
      OTHER,
    ]);
  });

  it("caps a note at 500 characters, so nobody pastes a payload into it", () => {
    expect(PURGE_NOTE_MAX_LENGTH).toBe(500);
  });

  it("purges from DEAD_LETTER and redrives back out of PURGED", () => {
    expect(DEAD_LETTER).toBe("DEAD_LETTER");
    expect(REDRIVABLE_STATUSES).toContain(PURGED);
  });
});

describe("purgeUpdate", () => {
  const setOf = (purge) => purgeUpdate(purge)[0].$set;
  const recordOf = (purge) => setOf(purge).lastPurge.$literal;
  const expiryOf = (purge) => setOf(purge).expireAt.$literal;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves the row PURGED", () => {
    expect(setOf(aPurge()).status).toBe(PURGED);
  });

  it("records who purged it, why, and when", () => {
    expect(recordOf(aPurge())).toEqual({
      at: NOW.toISOString(),
      by: "ada",
      reasonCode: "BROKEN_PAYLOAD",
      note: "the payload has no caseRef",
    });
  });

  it("stores the purge time as an ISO string", () => {
    expect(typeof recordOf(aPurge()).at).toBe("string");
  });

  it("stores an absent note as null, so every purged row has one shape", () => {
    expect(recordOf(aPurge({ note: undefined })).note).toBe(null);
  });

  it("stores an unattributed purge as a null operator", () => {
    expect(recordOf(aPurge({ by: undefined })).by).toBeNull();
    expect(JSON.stringify(purgeUpdate(aPurge({ by: null })))).not.toContain(
      "System",
    );
  });

  it("gives the row a deletion date one retention period out", () => {
    expect(expiryOf(aPurge())).toEqual(
      new Date(NOW.getTime() + RETENTION_DAYS * DAY_MS),
    );
  });

  // A TTL index silently ignores anything else, so a string is never deleted.
  it("writes the deletion date as a BSON Date, not a string", () => {
    expect(expiryOf(aPurge())).toBeInstanceOf(Date);
  });

  it("dates the record and the deadline from the same instant", () => {
    expect(
      expiryOf(aPurge()).getTime() - Date.parse(recordOf(aPurge()).at),
    ).toBe(RETENTION_DAYS * DAY_MS);
  });

  it("replaces the whole record rather than merging into it", () => {
    const update = purgeUpdate(aPurge({ note: undefined, by: undefined }));

    expect(update).toHaveLength(1);
    expect(Object.keys(update[0])).toEqual(["$set"]);
    expect(Object.keys(update[0].$set.lastPurge)).toEqual(["$literal"]);
    expect(Object.keys(update[0].$set.lastPurge.$literal).sort()).toEqual([
      "at",
      "by",
      "note",
      "reasonCode",
    ]);
  });

  it("appends the purge to the history, with the same record", () => {
    expect(setOf(aPurge()).history).toEqual(
      appendAction({ kind: "purged", ...recordOf(aPurge()) }),
    );
  });

  it("moves the payload revision on, so an editor opened before it is stale", () => {
    expect(setOf(aPurge()).payloadRevision).toEqual({
      $add: [{ $ifNull: ["$payloadRevision", 0] }, 1],
    });
  });

  // Purging is not redaction: the payload is what makes a redrive possible.
  it("touches nothing but the status, the record, the deadline, the revision and the history", () => {
    expect(Object.keys(setOf(aPurge())).sort()).toEqual([
      "expireAt",
      "history",
      "lastPurge",
      "payloadRevision",
      "status",
    ]);
  });

  // A pipeline reads a bare `$` string as a field path.
  it("stores a `$` string in the note as written", () => {
    expect(recordOf(aPurge({ note: "$status" })).note).toBe("$status");
  });

  it("can be given the instant, so a caller can date it deterministically", () => {
    const at = new Date("2020-01-01T00:00:00.000Z");

    expect(recordOf(aPurge({ at })).at).toBe(at.toISOString());
  });
});

describe("purgeConflict", () => {
  it("is a 409", () => {
    expect(purgeConflict("Inbox", ID, "COMPLETED").output.statusCode).toBe(409);
  });

  it("puts the current status in the body", () => {
    expect(purgeConflict("Inbox", ID, "COMPLETED").output.payload.status).toBe(
      "COMPLETED",
    );
  });

  it("names the box, the id and the status a purge needs", () => {
    expect(
      purgeConflict("Outbox", ID, "PUBLISHED").output.payload.message,
    ).toBe(`Outbox event "${ID}" is PUBLISHED, not DEAD_LETTER`);
  });

  it("has the same body shape as a redrive conflict", () => {
    const purged = purgeConflict("Inbox", ID, "COMPLETED").output.payload;
    const redriven = redriveConflict("Inbox", ID, "COMPLETED").output.payload;

    expect(Object.keys(purged).sort()).toEqual(Object.keys(redriven).sort());
    expect(purged.statusCode).toBe(redriven.statusCode);
    expect(purged.error).toBe(redriven.error);
  });
});
