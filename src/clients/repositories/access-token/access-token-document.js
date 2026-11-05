import { BSON, ObjectId } from "mongodb";
import { AccessToken } from "../../models/access-token.js";

// The stored row: `id` is the hash, the only lookup key auth has, and
// `client` the name. Only auth's lookup loads `id`; the list loads its masked
// ends.
export class AccessTokenDocument {
  constructor({ token, hash }) {
    this._id = ObjectId.createFromHexString(token.tokenId);
    this.id = hash;
    this.client = token.clientId;
    this.tokenHint = token.tokenHint;
    this.expiresAt = token.expiresAt;
    this.createdAt = token.createdAt;
    this.createdBy = token.createdBy;
  }

  static toAccessToken(doc) {
    return new AccessToken({
      tokenId: doc._id.toHexString(),
      clientId: doc.client,
      tokenHint: doc.tokenHint,
      expiresAt: doc.expiresAt,
      createdAt: doc.createdAt,
      createdBy: doc.createdBy,
      revokedAt: doc.revokedAt,
      revokedBy: doc.revokedBy,
    });
  }

  // Relaxed Extended JSON, as mongosh prints it: an ObjectId is `{ $oid }` and
  // a date `{ $date }`. Every field is kept, so `id` must already be masked.
  static toStored(doc) {
    return BSON.EJSON.serialize(doc, { relaxed: true });
  }
}
