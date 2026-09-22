import { describe, expect, it } from "vitest";
import { expiryFrom } from "./event-retention.js";

const AT = new Date("2026-06-16T10:00:00.000Z");

describe("expiryFrom", () => {
  it("is the given instant plus that many days", () => {
    expect(expiryFrom(AT, 90)).toEqual(new Date("2026-09-14T10:00:00.000Z"));
  });

  it("answers with a Date - a TTL index ignores a field holding anything else", () => {
    expect(expiryFrom(AT, 90)).toBeInstanceOf(Date);
  });

  it("counts in whole days across a British Summer Time change", () => {
    const beforeTheClocksGoBack = new Date("2026-10-20T10:00:00.000Z");

    // 24 hours a day, not the same wall-clock time: the deadline is an instant.
    expect(expiryFrom(beforeTheClocksGoBack, 30)).toEqual(
      new Date("2026-11-19T10:00:00.000Z"),
    );
  });

  it("does not mutate the date it was given", () => {
    const at = new Date(AT);

    expiryFrom(at, 90);

    expect(at).toEqual(AT);
  });

  it("scales with the number of days, so a shorter retention is a nearer date", () => {
    expect(expiryFrom(AT, 30).getTime()).toBeLessThan(
      expiryFrom(AT, 90).getTime(),
    );
  });
});
