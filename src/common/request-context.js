import { AsyncLocalStorage } from "node:async_hooks";
import { ENTRA_STRATEGY } from "../server/plugins/auth/entra.js";
import { config } from "./config.js";
import { logger } from "./logger.js";

const asyncLocalStorage = new AsyncLocalStorage();

// How many proxies in front of this service append to x-forwarded-for.
const TRUSTED_PROXY_COUNT = 1;

// The store holds raw request facts only: `remoteAddress` is the connection,
// `clientIp` is the forwarded address once a trusted caller has been
// authenticated. How those become an audit `ip` is the audit layer's rule
// (write-audit-event.js).
export const getRequestContext = () => asyncLocalStorage.getStore() ?? null;

// Each trusted proxy appends the address it received the request from, so
// the client is `trustedProxyCount` hops back from the connection. Anything
// further left was sent by the caller itself and cannot be trusted.
export const readClientIp = (request, trustedProxyCount) => {
  const forwardedFor = (request.headers?.["x-forwarded-for"] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const chain = [...forwardedFor, request.info.remoteAddress];

  return chain[Math.max(0, chain.length - 1 - trustedProxyCount)];
};

const wrapCycle = (request, cycle, store) => {
  const requestCycle = request[cycle].bind(request);
  request[cycle] = () => asyncLocalStorage.run(store, requestCycle);
};

const logClientIpDebug = (request) => {
  // TEMP FGP-1520: confirm proxy hop count in dev. Remove before merge.
  if (config.get("cdpEnvironment") !== "dev") {
    return;
  }

  logger.info(
    {
      xForwardedFor: request.headers?.["x-forwarded-for"] ?? null,
      remoteAddress: request.info.remoteAddress,
      path: request.path,
    },
    "FGP-1520 client ip debug",
  );
};

// Seeded before auth, so a caller cannot put its own address on the event
// just by sending the header. The forwarded value is applied afterwards,
// and only for the frontend's Entra requests.
const seedConnectionIp = (request, h) => {
  logClientIpDebug(request);
  const store = { remoteAddress: request.info.remoteAddress };
  wrapCycle(request, "_lifecycle", store);
  wrapCycle(request, "_postCycle", store);
  return h.continue;
};

const honoursForwardedIp = (request) =>
  request.auth?.strategy === ENTRA_STRATEGY;

const logChosenIp = (request, clientIp) => {
  logger.debug(
    {
      forwardedFor: request.headers?.["x-forwarded-for"],
      remoteAddress: request.info.remoteAddress,
      strategy: request.auth.strategy,
      clientIp,
    },
    "Chosen client IP from x-forwarded-for",
  );
};

const applyForwardedIp = (request, h) => {
  const context = getRequestContext();

  if (honoursForwardedIp(request) && context) {
    context.clientIp = readClientIp(request, TRUSTED_PROXY_COUNT);
    logChosenIp(request, context.clientIp);
  }

  return h.continue;
};

export const requestContext = {
  plugin: {
    name: "request-context",
    once: true,
    register(server) {
      server.ext("onRequest", seedConnectionIp);
      server.ext("onPostAuth", applyForwardedIp);
    },
  },
};
