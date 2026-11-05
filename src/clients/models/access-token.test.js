import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  AccessToken,
  apiClientErrors,
  assertExpiry,
  isActiveRecord,
  tokenStatus,
} from "./access-token.js";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const EARLIER = new Date("2026-11-01T09:00:00.000Z");
const LATER = new Date("2026-12-01T09:00:00.000Z");
const TOKEN_ID = "6650c1f2a9e4b1d07c20bd91";

const errorCodeOf = (call) => {
  try {
    call();
  } catch (error) {
    return [error.output.statusCode, error.output.payload.errorCode];
  }

  return null;
};

describe("AccessToken", () => {
  it("records nothing it was not given", () => {
    const token = new AccessToken({ tokenId: TOKEN_ID, clientId: "grants-ui" });

    expect({ ...token }).toEqual({
      tokenId: TOKEN_ID,
      clientId: "grants-ui",
      tokenHint: null,
      createdAt: null,
      createdBy: null,
      expiresAt: null,
      revokedAt: null,
      revokedBy: null,
    });
  });

  it("is held by the caller whose token row it is, and no other", () => {
    const token = AccessToken.createMock({ tokenId: TOKEN_ID });

    expect(token.isHeldBy(TOKEN_ID)).toBe(true);
    expect(token.isHeldBy("6650c1f2a9e4b1d07c20bd92")).toBe(false);
    expect(token.isHeldBy(null)).toBe(false);
  });

  it.each([
    ["absent", undefined],
    ["null", null],
    ["blank", "  "],
    ["not a string", 42],
    ["upper case and an underscore", "Grants_UI"],
    ["65 characters", "a".repeat(65)],
    ["64 hex characters, as a hash is", "a".repeat(64)],
  ])("has no client when the stored name is %s", (_, clientId) => {
    expect(AccessToken.createMock({ clientId }).clientId).toBeNull();
  });

  it("keeps a name that passes the name rule", () => {
    expect(AccessToken.createMock({ clientId: "z".repeat(64) }).clientId).toBe(
      "z".repeat(64),
    );
  });
});

describe("AccessToken status", () => {
  it.each([
    ["ACTIVE with no expiry", {}, tokenStatus.ACTIVE],
    ["ACTIVE before its expiry", { expiresAt: LATER }, tokenStatus.ACTIVE],
    ["EXPIRED at its expiry", { expiresAt: NOW }, tokenStatus.EXPIRED],
    ["EXPIRED past its expiry", { expiresAt: EARLIER }, tokenStatus.EXPIRED],
    [
      "REVOKED once revoked, whatever its expiry",
      { revokedAt: EARLIER, expiresAt: LATER },
      tokenStatus.REVOKED,
    ],
  ])("is %s", (_, facts, status) => {
    expect(AccessToken.createMock(facts).status(NOW)).toBe(status);
  });

  // Auth reads the same test, so the two cannot disagree on any stored value.
  it.each([
    ["no expiry", {}, true],
    ["a future expiry", { expiresAt: LATER }, true],
    ["a past expiry", { expiresAt: EARLIER }, false],
    [
      "a past expiry stored as a number",
      { expiresAt: EARLIER.getTime() },
      false,
    ],
    ["a revocation with no expiry", { revokedAt: EARLIER }, false],
  ])("treats a row with %s as auth does", (_, record, active) => {
    expect(isActiveRecord(record, NOW)).toBe(active);
    expect(AccessToken.createMock(record).isActive(NOW)).toBe(active);
  });
});

describe("AccessToken.revoke", () => {
  it("answers exactly what it changed: revoked now, by whom, expiring now", () => {
    const token = AccessToken.createMock();

    expect(token.revoke({ by: "Sam", now: NOW, callerTokenId: null })).toEqual({
      asRead: { revokedAt: null, expiresAt: null },
      changes: { revokedAt: NOW, revokedBy: "Sam", expiresAt: NOW },
    });
    expect(token.status(NOW)).toBe(tokenStatus.REVOKED);
  });

  it("answers the row as it was read, for the save to require", () => {
    const token = AccessToken.createMock({ expiresAt: LATER });

    expect(
      token.revoke({ by: "Sam", now: NOW, callerTokenId: null }).asRead,
    ).toEqual({ revokedAt: null, expiresAt: LATER });
  });

  it("refuses the token the request is authenticated with", () => {
    const token = AccessToken.createMock({ tokenId: TOKEN_ID });

    expect(
      errorCodeOf(() =>
        token.revoke({ by: "Sam", now: NOW, callerTokenId: TOKEN_ID }),
      ),
    ).toEqual([409, apiClientErrors.TOKEN_IN_USE]);
    expect(token.revokedAt).toBeNull();
  });

  it.each([
    ["revoked", { revokedAt: EARLIER, expiresAt: EARLIER }],
    ["expired", { expiresAt: EARLIER }],
  ])("refuses a token that is already %s", (_, facts) => {
    const token = AccessToken.createMock(facts);

    expect(
      errorCodeOf(() =>
        token.revoke({ by: "Sam", now: NOW, callerTokenId: null }),
      ),
    ).toEqual([409, apiClientErrors.TOKEN_NOT_ACTIVE]);
  });
});

describe("AccessToken.issue", () => {
  it("is a new active token created now by the operator, with its hint", () => {
    const token = AccessToken.issue({
      clientId: "grants-ui",
      tokenHint: "x9Q_",
      by: "Jane",
      now: NOW,
    });

    expect(ObjectId.isValid(token.tokenId)).toBe(true);
    expect({ ...token }).toEqual({
      tokenId: token.tokenId,
      clientId: "grants-ui",
      tokenHint: "x9Q_",
      createdAt: NOW,
      createdBy: "Jane",
      expiresAt: null,
      revokedAt: null,
      revokedBy: null,
    });
    expect(token.status(NOW)).toBe(tokenStatus.ACTIVE);
  });
});

describe("assertExpiry", () => {
  it.each([
    ["never", null],
    ["a future date", LATER],
    ["the last moment of 9999", new Date("9999-12-31T23:59:59.999Z")],
  ])("accepts %s", (_, expiresAt) => {
    expect(() => assertExpiry(expiresAt, NOW)).not.toThrow();
  });

  it.each([
    ["now", NOW],
    ["a past date", EARLIER],
    ["a date after 9999", new Date("+010000-01-01T00:00:00.000Z")],
    ["something not a date", "2999-01-01"],
    ["nothing", undefined],
  ])("refuses %s", (_, expiresAt) => {
    expect(errorCodeOf(() => assertExpiry(expiresAt, NOW))).toEqual([
      400,
      apiClientErrors.INVALID_EXPIRY,
    ]);
  });
});

describe("AccessToken.changeExpiry", () => {
  const change = (token, expiresAt, callerTokenId = null) =>
    token.changeExpiry({ expiresAt, now: NOW, callerTokenId });

  it.each([
    ["an active token", {}],
    ["an expired token", { expiresAt: EARLIER }],
  ])("sets the expiry of %s, reviving nothing", (_, facts) => {
    const token = AccessToken.createMock(facts);

    expect(change(token, LATER)).toMatchObject({
      changes: { expiresAt: LATER, revokedAt: null, revokedBy: null },
      revived: false,
    });
    expect(token.status(NOW)).toBe(tokenStatus.ACTIVE);
  });

  it("revives a revoked token, answering the row as it was read", () => {
    const token = AccessToken.createMock({
      revokedAt: EARLIER,
      revokedBy: "Sam",
      expiresAt: EARLIER,
    });

    expect(change(token, null)).toEqual({
      asRead: { revokedAt: EARLIER, expiresAt: EARLIER },
      changes: { expiresAt: null, revokedAt: null, revokedBy: null },
      revived: true,
    });
    expect(token.status(NOW)).toBe(tokenStatus.ACTIVE);
  });

  it("refuses a date that has passed", () => {
    expect(
      errorCodeOf(() => change(AccessToken.createMock(), EARLIER)),
    ).toEqual([400, apiClientErrors.INVALID_EXPIRY]);
  });

  it("refuses to end the token the request is made with", () => {
    const token = AccessToken.createMock({ tokenId: TOKEN_ID });

    expect(errorCodeOf(() => change(token, NOW, TOKEN_ID))).toEqual([
      409,
      apiClientErrors.TOKEN_IN_USE,
    ]);
  });

  it("refuses a date after 9999 as an expiry, even for the token the request is made with", () => {
    const token = AccessToken.createMock({ tokenId: TOKEN_ID });
    const afterLast = new Date("+010000-01-01T00:00:00.000Z");

    expect(errorCodeOf(() => change(token, afterLast, TOKEN_ID))).toEqual([
      400,
      apiClientErrors.INVALID_EXPIRY,
    ]);
  });

  it.each([
    ["a future date", LATER],
    ["never", null],
  ])("gives the token the request is made with %s", (_, expiresAt) => {
    const token = AccessToken.createMock({ tokenId: TOKEN_ID });

    expect(() => change(token, expiresAt, TOKEN_ID)).not.toThrow();
  });
});

describe("AccessToken.rotate", () => {
  const HOUR = 60 * 60 * 1000;
  const after = (ms) => new Date(NOW.getTime() + ms);

  it.each([
    ["none", null, NOW],
    ["24h", null, new Date("2026-11-05T23:59:59.000Z")],
    ["7d", null, new Date("2026-11-11T23:59:59.000Z")],
    ["7d", after(2 * HOUR), after(2 * HOUR)],
    ["24h", after(34 * HOUR), after(34 * HOUR)],
  ])(
    "with keepOld %s and expiry %s, ends the old token at %s",
    (keepOld, expiresAt, until) => {
      const token = AccessToken.createMock({ expiresAt });

      expect(token.rotate({ keepOld, now: NOW, callerTokenId: null })).toEqual({
        asRead: { revokedAt: null, expiresAt },
        changes: { expiresAt: until },
      });
    },
  );

  it.each([
    ["24h", "2026-10-25T23:30:00.000Z", "2026-10-26T23:59:59.000Z"],
    ["24h", "2026-10-24T23:30:00.000Z", "2026-10-25T23:59:59.000Z"],
    ["7d", "2026-10-20T22:30:00.000Z", "2026-10-27T23:59:59.000Z"],
    ["24h", "2026-03-28T12:00:00.000Z", "2026-03-29T22:59:59.000Z"],
    ["24h", "2026-03-28T23:30:00.000Z", "2026-03-30T22:59:59.000Z"],
    ["7d", "2026-03-24T12:00:00.000Z", "2026-03-31T22:59:59.000Z"],
    ["24h", "2026-07-01T23:30:00.000Z", "2026-07-03T22:59:59.000Z"],
  ])(
    "with keepOld %s at %s, ends the old token at 23:59:59 UK time, %s",
    (keepOld, now, until) => {
      const token = AccessToken.createMock({ expiresAt: null });

      expect(
        token.rotate({ keepOld, now: new Date(now), callerTokenId: null })
          .changes,
      ).toEqual({ expiresAt: new Date(until) });
    },
  );

  it.each([
    ["revoked", { revokedAt: EARLIER, expiresAt: EARLIER }],
    ["expired", { expiresAt: EARLIER }],
  ])("refuses a token that is %s", (_, facts) => {
    expect(
      errorCodeOf(() =>
        AccessToken.createMock(facts).rotate({
          keepOld: "24h",
          now: NOW,
          callerTokenId: null,
        }),
      ),
    ).toEqual([409, apiClientErrors.TOKEN_NOT_ACTIVE]);
  });

  it("refuses to rotate the token the request is made with without an overlap", () => {
    const token = AccessToken.createMock({ tokenId: TOKEN_ID });

    expect(
      errorCodeOf(() =>
        token.rotate({ keepOld: "none", now: NOW, callerTokenId: TOKEN_ID }),
      ),
    ).toEqual([409, apiClientErrors.TOKEN_IN_USE]);
  });

  it.each(["24h", "7d"])(
    "rotates the token the request is made with, kept for %s",
    (keepOld) => {
      const token = AccessToken.createMock({ tokenId: TOKEN_ID });

      expect(() =>
        token.rotate({ keepOld, now: NOW, callerTokenId: TOKEN_ID }),
      ).not.toThrow();
    },
  );
});
