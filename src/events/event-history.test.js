import { describe, expect, it } from "vitest";
import {
  appendHistory,
  deadLetteredEntry,
  KEPT_BEFORE_IMAGES,
  payloadEditedEntry,
  purgedEntry,
  pushHistory,
  redrivenEntry,
  toStoredHistory,
} from "./event-history.js";

const AT = "2026-06-16T10:00:00.000Z";

describe("history entries", () => {
  it("names each kind", () => {
    expect(deadLetteredEntry(AT)).toEqual({ kind: "dead-lettered", at: AT });
    expect(redrivenEntry({ at: AT, by: "ada" })).toEqual({
      kind: "redriven",
      at: AT,
      by: "ada",
    });
    expect(
      purgedEntry({ at: AT, by: "ada", reasonCode: "OTHER", note: null }),
    ).toEqual({
      kind: "purged",
      at: AT,
      by: "ada",
      reasonCode: "OTHER",
      note: null,
    });
  });

  it("keeps an edit's before-image only when it is given one", () => {
    expect(
      payloadEditedEntry({ at: AT, by: "ada", note: "n", before: { a: 1 } }),
    ).toEqual({
      kind: "payload-edited",
      at: AT,
      by: "ada",
      note: "n",
      before: { a: 1 },
    });
    expect(
      payloadEditedEntry({ at: AT, by: "ada", note: "n" }),
    ).not.toHaveProperty("before");
  });

  it("keeps five before-images", () => {
    expect(KEPT_BEFORE_IMAGES).toBe(5);
  });
});

describe("history updates", () => {
  it("pushes entries for an update document", () => {
    const entry = deadLetteredEntry(AT);

    expect(pushHistory([entry])).toEqual({ history: { $each: [entry] } });
  });

  it("appends a literal entry for an update pipeline, starting a missing history", () => {
    const entry = deadLetteredEntry(AT);

    expect(appendHistory(entry)).toEqual({
      $concatArrays: [{ $ifNull: ["$history", []] }, [{ $literal: entry }]],
    });
  });
});

describe("toStoredHistory", () => {
  it("reads a missing or malformed history as empty", () => {
    expect(toStoredHistory(undefined)).toEqual([]);
    expect(toStoredHistory({})).toEqual([]);
  });

  it("serialises a Date `at` and nulls a missing operator", () => {
    expect(toStoredHistory([{ kind: "redriven", at: new Date(AT) }])).toEqual([
      { kind: "redriven", at: AT, by: null },
    ]);
  });
});
