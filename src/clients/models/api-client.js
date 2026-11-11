import Boom from "@hapi/boom";
import { withErrorCode } from "../../common/with-error-code.js";
import { AccessToken, apiClientErrors, assertExpiry } from "./access-token.js";
import { isClientName } from "./client-name.js";

export const TOKEN_HASH = /^[0-9a-f]{64}$/;

// The last four characters of a raw token, which GPA generates as base64url.
export const TOKEN_HINT = /^[A-Za-z0-9_-]{4}$/;

const assertMatches = (value, pattern, message, errorCode) => {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw withErrorCode(Boom.badRequest(message), errorCode);
  }
};

const clientNotFound = (clientId) =>
  withErrorCode(
    Boom.notFound(`API client "${clientId}" not found`),
    apiClientErrors.CLIENT_NOT_FOUND,
  );

const assertName = (clientId) => {
  if (!isClientName(clientId)) {
    throw withErrorCode(
      Boom.badRequest("Invalid client name"),
      apiClientErrors.INVALID_NAME,
    );
  }
};

const hasActive = (clientId, active) => {
  const error = withErrorCode(
    Boom.conflict(`API client "${clientId}" has ${active} active tokens`),
    apiClientErrors.HAS_ACTIVE,
  );

  error.output.payload.active = active;

  return error;
};

// A view over the token rows that share a name, never stored. The exists and
// active checks read sibling rows, so two concurrent issues can both pass
// them: both rows are listed and revocable, so that is harmless.
export class ApiClient {
  constructor({ clientId, tokens }) {
    this.clientId = clientId;
    this.tokens = tokens;
  }

  static fromTokens(clientId, tokens) {
    return new ApiClient({ clientId, tokens });
  }

  static createMock(props) {
    return new ApiClient({
      clientId: "grants-ui",
      tokens: [AccessToken.createMock()],
      ...props,
    });
  }

  exists() {
    return this.tokens.length > 0;
  }

  assertExists() {
    if (!this.exists()) {
      throw clientNotFound(this.clientId);
    }
  }

  // Only the hash arrives, never the raw token. It is no part of the token, so
  // it is answered beside it, checked, for the store alone. A caller that says
  // whether the client is new is held to it; otherwise this decides, and
  // answers which it was.
  issueToken({
    tokenHash,
    tokenHint,
    expiresAt = null,
    newClient,
    confirmed = true,
    by,
    now,
  }) {
    assertName(this.clientId);
    assertMatches(
      tokenHash,
      TOKEN_HASH,
      "Invalid token hash",
      apiClientErrors.INVALID_HASH,
    );
    assertMatches(
      tokenHint,
      TOKEN_HINT,
      "Invalid token hint",
      apiClientErrors.INVALID_HINT,
    );
    assertExpiry(expiresAt, now);

    if (newClient === undefined) {
      this.#assertNoneActive(confirmed, now);
    } else {
      this.#assertNew(newClient);
    }

    return {
      newClient: !this.exists(),
      token: AccessToken.issue({
        clientId: this.clientId,
        tokenHint,
        expiresAt,
        by,
        now,
      }),
      tokenHash,
    };
  }

  // Issuing beside a working token is a choice the operator confirms.
  #assertNoneActive(confirmed, now) {
    const active = this.tokens.filter((token) => token.isActive(now)).length;

    if (active > 0 && !confirmed) {
      throw hasActive(this.clientId, active);
    }
  }

  #assertNew(newClient) {
    if (!newClient) {
      this.assertExists();
      return;
    }

    if (this.exists()) {
      throw withErrorCode(
        Boom.conflict(`API client "${this.clientId}" already exists`),
        apiClientErrors.CLIENT_EXISTS,
      );
    }
  }
}
