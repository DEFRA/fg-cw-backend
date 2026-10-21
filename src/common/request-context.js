import { AsyncLocalStorage } from "node:async_hooks";
import { isIP, isIPv6 } from "node:net";
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

export const requestContext = {
  plugin: {
    name: "request-context",
    once: true,
    register(server) {
      server.ext("onRequest", (request, h) => {
        const store = { ip: getAuditIp(request, TRUSTED_PROXY_COUNT) };
        wrapCycle(request, "_lifecycle", store);
        wrapCycle(request, "_postCycle", store);
        return h.continue;
      });
    },
  },
};
