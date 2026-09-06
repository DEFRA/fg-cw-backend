import Boom from "@hapi/boom";
import { findById } from "./access-token.repository.js";
import { hashToken } from "./hash-token.js";

export const PUBLIC_API_STRATEGY = "public-api";

export const SERVICE_TOKEN_SCHEME = "service-token";

const SERVICE_TOKEN_SECURITY = "serviceToken";

export const serviceTokenSecurity = {
  [SERVICE_TOKEN_SECURITY]: {
    type: "apiKey",
    name: "Authorization",
    in: "header",
    description:
      "A service access token, e.g. 'Bearer token..'. Issued with `npm run token:new`.",
  },
};

const BEARER_PREFIX = /^Bearer\s+/i;

const getBearerToken = (header) => {
  if (typeof header !== "string" || !BEARER_PREFIX.test(header)) {
    // the null form marks the credential as missing rather than invalid, so
    // a route stacking strategies falls through to the next one
    throw Boom.unauthorized(null, "Bearer");
  }
  return header.replace(BEARER_PREFIX, "").trim();
};

const isExpired = (record, now = new Date()) =>
  Boolean(record?.expiresAt && now > record.expiresAt);

export const serviceTokenScheme = () => ({
  authenticate: async (request, h) => {
    const tokenId = hashToken(getBearerToken(request.headers.authorization));
    const record = await findById(tokenId);

    if (!record || isExpired(record)) {
      throw Boom.unauthorized("Invalid token", "Bearer");
    }

    return h.authenticated({
      credentials: { service: record.client, tokenId: record.id },
    });
  },
});
