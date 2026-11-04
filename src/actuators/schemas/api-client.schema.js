import Joi from "joi";
import {
  apiClientErrors,
  KEEP_OLD,
  tokenStatus,
} from "../../clients/models/access-token.js";
import { HASH_RUN, MASKED_HASH } from "../../clients/models/masked-hash.js";
import { safeFailAction } from "../../common/validation.js";
import { withErrorCode } from "../../common/with-error-code.js";

const OBJECT_ID = /^[0-9a-f]{24}$/;

const tokenId = Joi.string()
  .pattern(OBJECT_ID)
  .required()
  .example("6650c1f2a9e4b1d07c20bd91")
  .description("the token row's 24-character hex _id");

// Shape only. Whether a name, hash or hint is valid is the model's rule, so
// a refusal of one is made inside the use case, where it is audited.
const SHAPE_MAX = 256;

const addressName = Joi.string()
  .max(SHAPE_MAX)
  .required()
  .example("grants-ui")
  .description(
    "the API client's name: lowercase letters, digits and hyphens, at most 64, and not 64 hex characters",
  );

export const clientParamsSchema = Joi.object({ clientId: addressName });

export const tokenParamsSchema = Joi.object({
  clientId: addressName,
  tokenId,
});

const tokenHash = Joi.string()
  .allow("")
  .max(SHAPE_MAX)
  .description("SHA-256 of the raw token, 64 lowercase hex");

const tokenHint = Joi.string()
  .allow("")
  .max(SHAPE_MAX)
  .description("the raw token's last 4 characters, base64url");

// Whether it is still to come is the model's rule, refused with its own code.
const expiresAt = Joi.date()
  .iso()
  .allow(null)
  .description(
    "when the token stops working, in the future and up to 9999-12-31; null for never",
  );

export const issueTokenPayloadSchema = Joi.object({
  tokenHash,
  tokenHint,
  expiresAt: expiresAt.default(null),
  newClient: Joi.boolean()
    .default(false)
    .description("create the client, which must not exist yet"),
}).label("IssueApiTokenRequest");

export const changeExpiryPayloadSchema = Joi.object({
  expiresAt: expiresAt.required(),
}).label("ChangeApiTokenExpiryRequest");

export const rotateTokenPayloadSchema = Joi.object({
  tokenHash,
  tokenHint,
  keepOld: Joi.string()
    .valid(...Object.keys(KEEP_OLD))
    .required()
    .description(
      "how long the old token keeps working beside the new one: none, or 24h or 7d and then to 23:59:59 UK time that day",
    ),
}).label("RotateApiTokenRequest");

const errorCodesByKey = {
  clientId: apiClientErrors.INVALID_NAME,
  tokenHash: apiClientErrors.INVALID_HASH,
  tokenHint: apiClientErrors.INVALID_HINT,
  expiresAt: apiClientErrors.INVALID_EXPIRY,
};

const errorCodeOf = (error) =>
  (error?.details ?? [])
    .map(({ path }) => errorCodesByKey[path[0]])
    .find(Boolean);

// As safeFailAction, plus the code GPA shows a refused name or hash by.
export const apiClientFailAction = (request, h, error) => {
  try {
    return safeFailAction(request, h, error);
  } catch (refusal) {
    const errorCode = errorCodeOf(error);

    throw errorCode ? withErrorCode(refusal, errorCode) : refusal;
  }
};

const nullableIso = Joi.string().isoDate().allow(null).required();
const nullableName = Joi.string().allow("", null).required();

// Closed, as every response here is: a hash field that ever reached one would
// fail it with a 500 rather than leave this service.
const tokenRow = Joi.object({
  tokenId,
  clientId: Joi.string()
    .allow(null)
    .required()
    .description("null when the row has no valid client name"),
  tokenHint: Joi.string()
    .allow(null)
    .required()
    .description("the raw token's last 4 characters; null if not recorded"),
  status: Joi.string()
    .valid(...Object.values(tokenStatus))
    .required()
    .description("derived when read, never stored"),
  createdAt: nullableIso,
  createdBy: nullableName,
  expiresAt: nullableIso,
  revokedAt: nullableIso,
  revokedBy: nullableName,
  inUse: Joi.boolean()
    .required()
    .description("whether this is the token the request is made with"),
}).label("ApiToken");

const objectId = Joi.object({
  $oid: Joi.string().pattern(OBJECT_ID).required(),
});

// No key or value but `id` holds a hash, and `id` holds only a masked one, so
// a stored row that would carry a whole hash fails with a 500 instead.
const storedValue = Joi.alternatives().try(
  Joi.string().allow("").pattern(HASH_RUN, { invert: true }),
  Joi.number(),
  Joi.boolean(),
  Joi.valid(null),
  objectId,
  Joi.object({ $date: Joi.string().isoDate().required() }),
);

const isStoredField = ([key, value]) =>
  !HASH_RUN.test(key) && !storedValue.validate(value).error;

// Its other fields are checked as a whole, so a refusal's path never names
// one: a key could be the hash.
const storedRow = Joi.object({
  _id: objectId.required(),
  id: Joi.string()
    .pattern(MASKED_HASH)
    .required()
    .example("a1b••••••f2c")
    .description("the hash's first and last 3 characters, never the rest"),
})
  .unknown(true)
  .custom((row, helpers) =>
    Object.entries(row).every(isStoredField)
      ? row
      : helpers.error("any.invalid"),
  )
  .description(
    "the row as stored, every field, in relaxed Extended JSON: an ObjectId is { $oid }, a date { $date }",
  )
  .label("StoredApiToken");

export const tokenListResponseSchema = Joi.object({
  tokens: Joi.array()
    .items(
      tokenRow.keys({ stored: storedRow.required() }).label("ListedApiToken"),
    )
    .required(),
}).label("ApiTokenListResponse");

export const issuedTokenResponseSchema = Joi.object({
  token: tokenRow.required(),
}).label("IssuedApiTokenResponse");

// What the change was, so a caller can record it from this answer alone.
export const changedExpiryResponseSchema = Joi.object({
  token: tokenRow.required(),
  previousExpiresAt: nullableIso.description("the expiry before the change"),
  revived: Joi.boolean()
    .required()
    .description("whether the token was revoked and is now revived"),
}).label("ChangedApiTokenExpiryResponse");

export const rotatedTokenResponseSchema = Joi.object({
  token: tokenRow.required(),
  oldExpiresAt: Joi.string()
    .isoDate()
    .required()
    .description("when the rotated token now stops working"),
}).label("RotatedApiTokenResponse");
