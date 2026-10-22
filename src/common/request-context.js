import { AsyncLocalStorage } from "node:async_hooks";
import { isIP, isIPv6 } from "node:net";
import { ENTRA_STRATEGY } from "../server/plugins/auth/entra.js";
import { config } from "./config.js";
import { logger } from "./logger.js";

const asyncLocalStorage = new AsyncLocalStorage();

// How many proxies in front of this service append to x-forwarded-for.
const TRUSTED_PROXY_COUNT = 1;

// The audit schema caps `ip` at 20 characters.
const MAX_AUDIT_IP_LENGTH = 20;

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

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

const compressIp = (ip) =>
  isIPv6(ip) ? new URL(`http://[${ip}]`).hostname.slice(1, -1) : ip;

// The shortest equivalent form of `address`, or undefined when it is not an
// IP: IPv4-mapped addresses become plain IPv4 and IPv6 is compressed.
export const normaliseIp = (address = "") => {
  // Drop any IPv6 zone id (e.g. `fe80::1%eth0`).
  const ip = address.split("%")[0].replace(IPV4_MAPPED, "$1");

  return isIP(ip) ? compressIp(ip) : undefined;
};

const fitsAuditSchema = (ip) => ip?.length <= MAX_AUDIT_IP_LENGTH;

export const getAuditIp = (request, trustedProxyCount) => {
  const clientIp = normaliseIp(readClientIp(request, trustedProxyCount));

  if (fitsAuditSchema(clientIp)) {
    return clientIp;
  }

  logger.warn(
    `Client IP is not an IP of at most ${MAX_AUDIT_IP_LENGTH} characters - auditing the connection address instead.`,
  );

  const remoteAddress = normaliseIp(request.info.remoteAddress);

  return fitsAuditSchema(remoteAddress) ? remoteAddress : undefined;
};

const wrapCycle = (request, cycle, store) => {
  const requestCycle = request[cycle].bind(request);
  request[cycle] = () => asyncLocalStorage.run(store, requestCycle);
};

// Seeded before auth, so a caller cannot put its own address on the event
// just by sending the header. The forwarded value is applied afterwards,
// and only for the frontend's Entra requests.
const connectionIp = (request) => {
  const ip = normaliseIp(request.info.remoteAddress);

  return fitsAuditSchema(ip) ? ip : undefined;
};

const logClientIpDebug = (request) => {
  // TEMP FGP-1520: confirm proxy hop count in dev. Remove before merge.
  if (config.get("cdpEnvironment") !== "dev") {
    return;
  }

  logger.info(
    {
      xForwardedFor: request.headers["x-forwarded-for"] ?? null,
      remoteAddress: request.info.remoteAddress,
      path: request.path,
    },
    "FGP-1520 client ip debug",
  );
};

const seedConnectionIp = (request, h) => {
  logClientIpDebug(request);
  const store = { ip: connectionIp(request) };
  wrapCycle(request, "_lifecycle", store);
  wrapCycle(request, "_postCycle", store);
  return h.continue;
};

const honoursForwardedIp = (request) =>
  request.auth?.strategy === ENTRA_STRATEGY;

const logChosenIp = (request, ip) => {
  logger.debug(
    {
      forwardedFor: request.headers?.["x-forwarded-for"],
      remoteAddress: request.info.remoteAddress,
      strategy: request.auth.strategy,
      ip,
    },
    "Chosen audit client IP from x-forwarded-for",
  );
};

const applyForwardedIp = (request, h) => {
  const context = getRequestContext();

  if (honoursForwardedIp(request) && context) {
    context.ip = getAuditIp(request, TRUSTED_PROXY_COUNT);
    logChosenIp(request, context.ip);
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
