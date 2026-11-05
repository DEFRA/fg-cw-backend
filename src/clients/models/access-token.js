import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { endOfUkDay } from "../../common/date-helpers.js";
import { withErrorCode } from "../../common/with-error-code.js";
import { isClientName } from "./client-name.js";

export const tokenStatus = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
};

export const apiClientErrors = {
  INVALID_NAME: "API_CLIENT_INVALID_NAME",
  INVALID_HASH: "API_TOKEN_INVALID_HASH",
  INVALID_HINT: "API_TOKEN_INVALID_HINT",
  INVALID_EXPIRY: "API_TOKEN_INVALID_EXPIRY",
  CLIENT_EXISTS: "API_CLIENT_EXISTS",
  CLIENT_NOT_FOUND: "API_CLIENT_NOT_FOUND",
  TOKEN_NOT_FOUND: "API_TOKEN_NOT_FOUND",
  TOKEN_NOT_ACTIVE: "API_TOKEN_NOT_ACTIVE",
  TOKEN_IN_USE: "API_TOKEN_IN_USE",
  TOKEN_ACTIVE: "API_TOKEN_ACTIVE",
  TOKEN_DUPLICATE: "API_TOKEN_DUPLICATE",
};

export const tokenNotFound = (tokenId) =>
  withErrorCode(
    Boom.notFound(`Token "${tokenId}" not found`),
    apiClientErrors.TOKEN_NOT_FOUND,
  );

export const tokenNotActive = (tokenId) =>
  withErrorCode(
    Boom.conflict(`Token "${tokenId}" is not active`),
    apiClientErrors.TOKEN_NOT_ACTIVE,
  );

const isExpired = (expiresAt, now) => Boolean(expiresAt && now >= expiresAt);

// Auth's own test, so whether a stored token authenticates never disagrees
// with its status, whatever the stored values are.
export const isActiveRecord = ({ revokedAt, expiresAt }, now = new Date()) =>
  revokedAt == null && !isExpired(expiresAt, now);

const orNull = (value) => value ?? null;

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const WEEK_MS = DAYS_PER_WEEK * DAY_MS;

// How long a rotated token keeps working beside its replacement, at least:
// an overlap runs on to the end of the UK day it reaches.
export const KEEP_OLD = { none: 0, "24h": DAY_MS, "7d": WEEK_MS };

const overlapEnd = (keepOld, now) =>
  KEEP_OLD[keepOld] === 0
    ? now
    : endOfUkDay(new Date(now.getTime() + KEEP_OLD[keepOld]));

const inUse = (message) =>
  withErrorCode(Boom.conflict(message), apiClientErrors.TOKEN_IN_USE);

const isFuture = (expiresAt, now) => expiresAt === null || expiresAt > now;

// The last date relaxed Extended JSON writes as an ISO string, the only form
// the list's stored row accepts.
export const LAST_EXPIRY = new Date("9999-12-31T23:59:59.999Z");

const isExpiry = (expiresAt) =>
  expiresAt === null || (expiresAt instanceof Date && expiresAt <= LAST_EXPIRY);

// Never, or a date still to come: an expiry that has already passed would
// issue or revive a token that cannot be used.
export const assertExpiry = (expiresAt, now) => {
  if (!isExpiry(expiresAt) || !isFuture(expiresAt, now)) {
    throw withErrorCode(
      Boom.badRequest(
        "Expiry must be a future date up to 9999-12-31, or never",
      ),
      apiClientErrors.INVALID_EXPIRY,
    );
  }
};

const earlier = (current, limit) =>
  current === null || limit < current ? limit : current;

// A token owned by no client it could be managed under has no name: a row
// without one, or with one that fails the name rule.
export class AccessToken {
  constructor({ tokenId, clientId, tokenHint, expiresAt, ...facts }) {
    this.tokenId = tokenId;
    this.clientId = isClientName(clientId) ? clientId : null;
    this.tokenHint = orNull(tokenHint);
    this.expiresAt = orNull(expiresAt);
    this.createdAt = orNull(facts.createdAt);
    this.createdBy = orNull(facts.createdBy);
    this.revokedAt = orNull(facts.revokedAt);
    this.revokedBy = orNull(facts.revokedBy);
  }

  static issue({ clientId, tokenHint, expiresAt, by, now }) {
    return new AccessToken({
      tokenId: new ObjectId().toHexString(),
      clientId,
      tokenHint,
      expiresAt,
      createdAt: now,
      createdBy: by,
    });
  }

  static createMock(props) {
    return new AccessToken({
      tokenId: new ObjectId().toHexString(),
      clientId: "grants-ui",
      ...props,
    });
  }

  status(now) {
    if (this.revokedAt !== null) {
      return tokenStatus.REVOKED;
    }

    return isExpired(this.expiresAt, now)
      ? tokenStatus.EXPIRED
      : tokenStatus.ACTIVE;
  }

  isActive(now) {
    return isActiveRecord(this, now);
  }

  isHeldBy(callerTokenId) {
    return this.tokenId === callerTokenId;
  }

  // What a save requires to be unchanged since the read.
  #asRead() {
    return { revokedAt: this.revokedAt, expiresAt: this.expiresAt };
  }

  #apply(changes) {
    const asRead = this.#asRead();

    Object.assign(this, changes);

    return { asRead, changes };
  }

  // Expiring it is what stops auth accepting it, on this image or an older
  // one. Answers what changed, which is all a save may write.
  revoke({ by, now, callerTokenId }) {
    if (this.isHeldBy(callerTokenId)) {
      throw inUse("A request cannot revoke the token it is made with");
    }

    if (!this.isActive(now)) {
      throw tokenNotActive(this.tokenId);
    }

    return this.#apply({ revokedAt: now, revokedBy: by, expiresAt: now });
  }

  // Revives a revoked token, since a new expiry is a decision to let it work
  // again; the audit keeps the revocation.
  changeExpiry({ expiresAt, now, callerTokenId }) {
    if (this.isHeldBy(callerTokenId) && !isFuture(expiresAt, now)) {
      throw inUse("A request cannot expire the token it is made with");
    }

    assertExpiry(expiresAt, now);

    const revived = this.revokedAt !== null;

    return {
      ...this.#apply({ expiresAt, revokedAt: null, revokedBy: null }),
      revived,
    };
  }

  // Only a token nobody can call with may go; the one a request is made with is
  // always active, so it never can.
  assertDeletable(now) {
    if (this.isActive(now)) {
      throw withErrorCode(
        Boom.conflict(`Token "${this.tokenId}" is active`),
        apiClientErrors.TOKEN_ACTIVE,
      );
    }
  }

  // The old token keeps working for the overlap, never longer than it would
  // have. Without one, the caller's own token would stop under it.
  rotate({ keepOld, now, callerTokenId }) {
    if (!this.isActive(now)) {
      throw tokenNotActive(this.tokenId);
    }

    if (this.isHeldBy(callerTokenId) && KEEP_OLD[keepOld] === 0) {
      throw inUse(
        "The token a request is made with needs an overlap to rotate",
      );
    }

    return this.#apply({
      expiresAt: earlier(this.expiresAt, overlapEnd(keepOld, now)),
    });
  }
}
