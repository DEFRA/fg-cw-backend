import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { AccessToken } from "../../models/access-token.js";
import { AccessTokenDocument } from "./access-token-document.js";

const ID = new ObjectId("6650c1f2a9e4b1d07c20bd91");
const NOW = new Date("2026-11-04T12:00:00.000Z");
const HASH = "a".repeat(64);

const anIssuedToken = () =>
  AccessToken.issue({
    clientId: "grants-ui",
    tokenHint: "x9Q_",
    by: "Jane",
    now: NOW,
  });

describe("AccessTokenDocument", () => {
  it("reads a row from before CW-2, with none of the new fields", () => {
    const token = AccessTokenDocument.toAccessToken({
      _id: ID,
      client: "fg-gas-backend",
      expiresAt: null,
    });

    expect(token).toBeInstanceOf(AccessToken);
    expect(token).toMatchObject({
      tokenId: ID.toHexString(),
      clientId: "fg-gas-backend",
      tokenHint: null,
      createdAt: null,
      createdBy: null,
      revokedAt: null,
    });
  });

  it("reads a row whose client is not a valid name as nameless", () => {
    expect(
      AccessTokenDocument.toAccessToken({
        _id: ID,
        client: "Grants_UI",
        expiresAt: null,
      }).clientId,
    ).toBeNull();
  });

  it("stores an issued token with its hash and hint", () => {
    const token = anIssuedToken();

    expect({ ...new AccessTokenDocument({ token, hash: HASH }) }).toEqual({
      _id: new ObjectId(token.tokenId),
      id: HASH,
      client: "grants-ui",
      tokenHint: "x9Q_",
      expiresAt: null,
      createdAt: NOW,
      createdBy: "Jane",
    });
  });

  it("round-trips", () => {
    const token = anIssuedToken();

    expect(
      AccessTokenDocument.toAccessToken(
        new AccessTokenDocument({ token, hash: HASH }),
      ),
    ).toEqual(token);
  });

  it("writes a stored row as relaxed Extended JSON, every field kept", () => {
    const _id = new ObjectId();

    expect(
      AccessTokenDocument.toStored({
        _id,
        id: "aaa••••••aaa",
        client: "grants-ui",
        expiresAt: NOW,
        revokedAt: null,
        legacy: 1,
      }),
    ).toEqual({
      _id: { $oid: _id.toHexString() },
      id: "aaa••••••aaa",
      client: "grants-ui",
      expiresAt: { $date: "2026-11-04T12:00:00Z" },
      revokedAt: null,
      legacy: 1,
    });
  });
});
